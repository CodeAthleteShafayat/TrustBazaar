"""Upload route — returns a public URL for a Supabase Storage bucket."""
import uuid
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..extensions import get_supabase, limiter
from ..utils.errors import err

bp = Blueprint("upload", __name__)

ALLOWED_MIME_EXT = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
}
MAX_FILE_BYTES = 8 * 1024 * 1024  # 8MB


@bp.post("/<bucket>")
@jwt_required()
@limiter.limit("20 per minute")
def upload(bucket):
    if bucket not in ("listing-photos", "dispute-evidence"):
        return err("validation_error", "Invalid bucket", 400)
    if "file" not in request.files:
        return err("validation_error", "multipart field 'file' required", 400)

    file = request.files["file"]
    ext = ALLOWED_MIME_EXT.get(file.mimetype)
    if not ext:
        return err("validation_error", "Only JPEG, PNG, WebP, or GIF images are allowed", 400)

    contents = file.read(MAX_FILE_BYTES + 1)
    if len(contents) > MAX_FILE_BYTES:
        return err("validation_error", "File too large (max 8MB)", 400)

    uid = get_jwt_identity()
    # Filename is never taken from client input — it was previously spliced straight
    # into the storage path (`file.filename`, fully attacker-controlled), which is a
    # path-traversal/collision risk. Scoping to the uploader's own id also means a user
    # can never overwrite another user's uploaded file even by accident.
    path = f"{uid}/{uuid.uuid4().hex}.{ext}"
    sb = get_supabase()
    sb.storage.from_(bucket).upload(path, contents, {"content-type": file.mimetype})
    public_url = sb.storage.from_(bucket).get_public_url(path)
    return jsonify(data={"path": path, "url": public_url}), 201
