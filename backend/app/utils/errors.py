from flask import jsonify


def err(code: str, message: str, status: int):
    return jsonify(error={"code": code, "message": message}), status
