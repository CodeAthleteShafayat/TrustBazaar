#!/usr/bin/env python3
"""
apply_sql.py — Run any .sql file against the TrustBazaar Supabase database.

Usage:
  python apply_sql.py path/to/file.sql

Reads the connection string from DATABASE_URL env var (if set),
or expects you to have set SUPABASE_DB_URL in .env, or pass --url.

The Supabase dashboard exposes the connection string at:
  Project Settings → Database → Connection string → URI tab
Use the "Transaction" pooler (port 6543) — works with IPv4 and IPv6.

This script splits the SQL into individual statements and runs each one
separately so a single bad statement doesn't abort the whole file.
"""
import os
import sys
import re
import argparse
from pathlib import Path

try:
    import psycopg2
except ImportError:
    print("psycopg2-binary not installed. Run: pip install psycopg2-binary")
    sys.exit(1)

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent / ".env" if (Path(__file__).parent / ".env").exists() else Path.cwd() / ".env")
except Exception:
    pass


def split_sql(sql_text: str):
    """Naive split on `;\n` boundaries — good enough for our migrations.
    Skips comments and empty statements."""
    statements = []
    buf = []
    for line in sql_text.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("--"):
            continue
        buf.append(line)
        if stripped.endswith(";"):
            stmt = "\n".join(buf).rstrip(";").strip()
            if stmt:
                statements.append(stmt)
            buf = []
    leftover = "\n".join(buf).strip()
    if leftover:
        statements.append(leftover)
    return statements


def get_connection() -> "psycopg2.extensions.connection":
    """Build a pg8000/psycopg2 connection from individual env vars or a URL."""
    url = os.environ.get("DATABASE_URL") or os.environ.get("SUPABASE_DB_URL")
    if url:
        # Mask password in logs later
        return psycopg2.connect(url)

    supabase_url = os.environ.get("SUPABASE_URL", "")
    db_password = os.environ.get("SUPABASE_DB_PASSWORD")
    db_host = os.environ.get("SUPABASE_DB_HOST")  # e.g. aws-0-us-east-1.pooler.supabase.com
    db_port = int(os.environ.get("SUPABASE_DB_PORT", "6543"))
    db_user = os.environ.get("SUPABASE_DB_USER")  # e.g. postgres.<your-project-ref>
    db_name = os.environ.get("SUPABASE_DB_NAME", "postgres")

    if not db_host:
        m = re.match(r"https?://([a-z0-9]+)\.supabase\.co", supabase_url)
        if not m:
            print(f"Could not parse project ref from SUPABASE_URL={supabase_url}")
            sys.exit(2)
        ref = m.group(1)
        db_user = db_user or f"postgres.{ref}"
        db_host = "aws-0-us-east-1.pooler.supabase.com"

    if not (db_host and db_user and db_password):
        print("Missing database connection info. Set one of:")
        print("  DATABASE_URL=postgresql://...  in .env, OR")
        print("  SUPABASE_DB_HOST + SUPABASE_DB_USER + SUPABASE_DB_PASSWORD in .env")
        print()
        print("Get these from Supabase Dashboard → Project Settings → Database → Connection string → URI")
        sys.exit(2)

    return psycopg2.connect(
        host=db_host,
        port=db_port,
        user=db_user,
        password=db_password,
        dbname=db_name,
        connect_timeout=10,
    )


def main():
    p = argparse.ArgumentParser(description="Apply a .sql file to Supabase")
    p.add_argument("sql_file", help="path to .sql file")
    p.add_argument("--url", help="full connection URL override")
    p.add_argument("--dry-run", action="store_true", help="print statements without running")
    args = p.parse_args()

    sql_path = Path(args.sql_file)
    if not sql_path.exists():
        print(f"File not found: {sql_path}")
        sys.exit(2)

    sql = sql_path.read_text()
    stmts = split_sql(sql)
    print(f"Loaded {len(stmts)} statements from {sql_path.name}")

    if args.dry_run:
        print("--DRY RUN--")
        for i, s in enumerate(stmts[:5], 1):
            print(f"[{i}] {s[:80]}...")
        sys.exit(0)

    if args.url:
        print("Connecting via --url (passwords not echoed)")
        conn = psycopg2.connect(args.url, connect_timeout=10)
    else:
        # Show host (no password)
        print(f"Connecting to {os.environ.get('SUPABASE_DB_HOST', 'aws-0-us-east-1.pooler.supabase.com')}:{os.environ.get('SUPABASE_DB_PORT', '6543')} as {os.environ.get('SUPABASE_DB_USER') or 'postgres.<ref>'}")
        conn = get_connection()

    conn.autocommit = True
    cur = conn.cursor()
    ok = 0
    fail = 0
    for i, stmt in enumerate(stmts, 1):
        try:
            cur.execute(stmt)
            ok += 1
        except Exception as e:
            fail += 1
            preview = stmt.replace("\n", " ")[:100]
            print(f"  [{i}/{len(stmts)}] FAIL: {e}")
            print(f"     > {preview}...")
    cur.close()
    conn.close()
    print()
    print(f"Done — {ok} succeeded, {fail} failed")
    sys.exit(0 if fail == 0 else 1)


if __name__ == "__main__":
    main()
