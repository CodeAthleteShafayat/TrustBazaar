"""Upload route — returns a public URL for a Supabase Storage bucket."""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from ..extensions import get_supabase
from ..utils.errors import err

bp = Blueprint("upload", __name__)


@bp.post("/<bucket>")
@jwt_required()
def upload(bucket):
    if bucket not in ("listing-photos", "dispute-evidence"):
        return err("validation_error", "Invalid bucket", 400)
    if "file" not in request.files:
        return err("validation_error", "multipart field 'file' required", 400)

    file = request.files["file"]
    sb = get_supabase()
    path = f"{request.form.get('folder', 'misc')}/{file.filename}"
    res = sb.storage.from_(bucket).upload(path, file.read(), {"content-type": file.mimetype})
    public_url = sb.storage.from_(bucket).get_public_url(path)
    return jsonify(data={"path": path, "url": public_url}), 201
