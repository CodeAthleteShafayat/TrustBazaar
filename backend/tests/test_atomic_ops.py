"""test_atomic_ops.py — guarantees that every wallet_ledger write happens
inside a PostgreSQL transaction (PL/pgSQL function body in
011_atomic_ops.sql), and that no Flask route performs direct
wallet_ledger writes outside the RPC layer.

This is a structural test, not a runtime test against a live database.
It exists so a regression in the routes — e.g. someone reintroducing a
`.insert(...)` on `wallet_ledger` — fails CI before any money moves.
"""
from pathlib import Path
import re

REPO = Path(__file__).resolve().parents[2]
MIGRATION = REPO / "supabase" / "migrations" / "011_atomic_ops.sql"
ROUTES_DIR = REPO / "backend" / "app" / "routes"


def _strip_comments_and_strings(sql: str) -> str:
    """Return SQL with -- line comments and string literals blanked out,
    so we can do structural matching without false positives from
    `'order:…'` inside VALUES clauses.
    """
    # Strip line comments.
    sql = re.sub(r"--[^\n]*", "", sql)
    # Blank out single-quoted string literals.
    sql = re.sub(r"'(?:''|[^'])*'", "''", sql)
    return sql


def test_011_migration_defines_all_five_financial_rpcs():
    """All five settlement RPCs must exist in the migration."""
    raw = MIGRATION.read_text()
    for fn in (
        "create_order_atomic",
        "create_rental_atomic",
        "complete_order_atomic",
        "complete_rental_atomic",
        "resolve_dispute_atomic",
        "payout_atomic",
    ):
        assert f"function public.{fn}" in raw, f"missing function public.{fn}"


def test_011_migration_revoke_all_from_public():
    """Every RPC must be revoked from PUBLIC so anon cannot invoke it."""
    raw = MIGRATION.read_text()
    for fn in (
        "create_order_atomic",
        "create_rental_atomic",
        "complete_order_atomic",
        "complete_rental_atomic",
        "resolve_dispute_atomic",
        "payout_atomic",
    ):
        assert f"revoke all on function public.{fn}" in raw, (
            f"missing revoke on {fn}"
        )


def test_unique_index_for_idempotency_exists():
    """A unique index on (type, reference) is what makes a retry safe."""
    raw = MIGRATION.read_text()
    assert "uq_wallet_ledger_type_ref" in raw
    assert re.search(
        r"create unique index if not exists uq_wallet_ledger_type_ref\s+on public\.wallet_ledger \(type, reference\)",
        raw,
    )


def test_every_wallet_ledger_insert_in_migration_is_inside_plpgsql_function():
    """A wallet_ledger INSERT in the migration must sit between a `language
    plpgsql ... as $$` opener and the matching `$$;` closer. Any INSERT
    outside a function body would mean a ledger write runs as a plain
    auto-commit SQL statement, which violates the atomicity contract.
    """
    raw = _strip_comments_and_strings(MIGRATION.read_text())
    # Build a character map: char index → True if inside a PL/pgSQL body.
    in_body = [False] * len(raw)
    depth = 0  # 0 = outside, 1 = inside
    i = 0
    while i < len(raw):
        if depth == 0:
            # Look for a function opener.
            m = re.match(r"language plpgsql[^$]*\$\$", raw[i:])
            if m:
                # Mark everything from end-of-opener onward as inside body.
                start = i + m.end()
                # Find the closing $$;
                close = raw.find("$$;", start)
                assert close != -1, "PL/pgSQL function body opened but never closed"
                for j in range(start, close):
                    in_body[j] = True
                i = close + 3
                continue
        i += 1

    # Now scan for wallet_ledger inserts and assert each is inside a body.
    for m in re.finditer(r"insert into public\.wallet_ledger", raw):
        assert in_body[m.start()], (
            f"wallet_ledger INSERT at offset {m.start()} is outside a "
            "PL/pgSQL function body"
        )


def test_every_settlement_rpc_catches_unique_violation():
    """Each settlement/dispute RPC must catch unique_violation so a retry
    does not bubble SQLSTATE 23505 to the caller, and must early-return
    on already-settled state so the caller sees the same row on retry.
    """
    # Use the raw migration (no stripping) so string literals like 'paid'
    # / 'shipped' / 'completed' are present in the body slice.
    raw = MIGRATION.read_text()
    for fn in (
        "complete_order_atomic",
        "complete_rental_atomic",
        "resolve_dispute_atomic",
    ):
        header = f"create or replace function public.{fn}"
        start = raw.find(header)
        assert start != -1, f"function {fn} not found"
        close = raw.find("$$;", start)
        body = raw[start:close]
        # Strip -- comments from this slice but keep string literals.
        code = re.sub(r"--[^\n]*", "", body)
        assert "exception when unique_violation then" in code, (
            f"{fn} does not catch unique_violation — retry will raise 23505"
        )
        # The early-return branch must check the terminal status literal
        # ('completed' for orders, 'completed'/'resolved' for disputes).
        if fn == "resolve_dispute_atomic":
            assert "'resolved'" in code, (
                f"{fn} has no early-return for already-resolved dispute"
            )
        else:
            assert "'completed'" in code, (
                f"{fn} has no early-return for already-completed state"
            )


def test_no_flask_route_writes_wallet_ledger_directly():
    """Every wallet_ledger write must go through an RPC. Routes may only
    *read* wallet_ledger (e.g. for the wallet view) or invoke an RPC.
    """
    for py in sorted(ROUTES_DIR.glob("*.py")):
        text = py.read_text()
        # Allow reads (.select(...) on wallet_ledger).
        # Forbid writes (.insert(.into.*wallet_ledger|.update(.wallet_ledger)).
        if re.search(r"\.insert\([^)]*wallet_ledger", text, re.S):
            raise AssertionError(
                f"{py.name} performs a direct wallet_ledger insert — "
                "all financial writes must go through an RPC in 011_atomic_ops.sql"
            )
        if re.search(r"\.update\([^)]*wallet_ledger", text, re.S):
            raise AssertionError(
                f"{py.name} performs a direct wallet_ledger update — "
                "all financial writes must go through an RPC"
            )


def test_orders_route_settlement_calls_complete_order_atomic():
    text = (ROUTES_DIR / "orders.py").read_text()
    assert "complete_order_atomic" in text
    # The RPC must replace both the order update AND the wallet_ledger insert.
    assert "wallet_ledger" not in text, (
        "orders.py still references wallet_ledger — confirm_order must "
        "delegate to complete_order_atomic"
    )


def test_rentals_route_settlement_calls_complete_rental_atomic():
    text = (ROUTES_DIR / "rentals.py").read_text()
    assert "complete_rental_atomic" in text
    assert "wallet_ledger" not in text, (
        "rentals.py still references wallet_ledger — confirm_return must "
        "delegate to complete_rental_atomic"
    )


def test_admin_route_settlement_calls_resolve_dispute_atomic():
    raw = (ROUTES_DIR / "admin.py").read_text()
    # Strip comments so the substring check ignores docstring/comment
    # mentions of wallet_ledger that exist purely as explanation.
    text = re.sub(r"#.*", "", raw)
    text = re.sub(r'""".*?"""', "", text, flags=re.S)
    assert "resolve_dispute_atomic" in text
    assert "wallet_ledger" not in text, (
        "admin.py still references wallet_ledger in code — dispute "
        "resolution must delegate to resolve_dispute_atomic"
    )