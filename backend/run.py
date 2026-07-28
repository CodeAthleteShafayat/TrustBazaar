from app import create_app
from app.config import Config

app = create_app()

if __name__ == "__main__":
    # Config.DEBUG is False whenever FLASK_ENV=production — never hardcode True here.
    # In production this file shouldn't even be the entrypoint; use gunicorn instead
    # (see Procfile), which ignores this __main__ block entirely.
    app.run(host="0.0.0.0", port=Config.PORT, debug=Config.DEBUG)
