from flask import Flask, jsonify
import os
from .config import Config
from .extensions import init_supabase_if_configured, cors, jwt, limiter
from .routes.auth import bp as auth_bp
from .routes.listings import bp as listings_bp
from .routes.orders import bp as orders_bp
from .routes.rentals import bp as rentals_bp
from .routes.disputes import bp as disputes_bp
from .routes.trust_score import bp as trust_bp
from .routes.wallet import bp as wallet_bp
from .routes.admin import bp as admin_bp
from .routes.upload import bp as upload_bp


def create_app(config_class: type = Config) -> Flask:
    app = Flask(__name__)
    app.config.from_object(config_class)

    init_supabase_if_configured(app.config["SUPABASE_URL"], app.config["SUPABASE_SERVICE_ROLE_KEY"], app.config["SUPABASE_ANON_KEY"])
    cors.init_app(app, resources={r"/api/*": {"origins": app.config["FRONTEND_ORIGIN"]}})
    jwt.init_app(app)
    limiter.init_app(app)

    @app.get("/health")
    def health():
        return jsonify(status="ok", service="trustbazaar-api", version="0.1.0")

    @app.errorhandler(404)
    def not_found(_e):
        return jsonify(error={"code": "not_found", "message": "Resource not found"}), 404

    @app.errorhandler(500)
    def internal(e):
        app.logger.exception(e)
        return jsonify(error={"code": "internal", "message": "Internal server error"}), 500

    @app.errorhandler(429)
    def rate_limited(e):
        return jsonify(error={"code": "rate_limited", "message": "Too many requests — try again shortly."}), 429

    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(listings_bp, url_prefix="/api/listings")
    app.register_blueprint(orders_bp, url_prefix="/api/orders")
    app.register_blueprint(rentals_bp, url_prefix="/api/rentals")
    app.register_blueprint(disputes_bp, url_prefix="/api/disputes")
    app.register_blueprint(trust_bp, url_prefix="/api/trust-score")
    app.register_blueprint(wallet_bp, url_prefix="/api/wallet")
    app.register_blueprint(admin_bp, url_prefix="/api/admin")
    app.register_blueprint(upload_bp, url_prefix="/api/upload")

    return app
