package com.turfchai.media.service;

import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Map;
import java.util.Set;

/**
 * Handles all media uploads to Cloudinary.
 *
 * <p>Constraints enforced before upload:
 * <ul>
 *   <li>MIME type: must be image/jpeg, image/png, or image/webp</li>
 *   <li>File size: must not exceed {@code media.max-file-size-mb} (default 5 MB)</li>
 * </ul>
 *
 * <p>All assets are stored under the folder configured by {@code media.upload-folder}
 * (default: {@code TurfChai}), organised into sub-folders by resource type:
 * <ul>
 *   <li>{@code TurfChai/venues/}   — venue & pitch photos</li>
 *   <li>{@code TurfChai/avatars/}  — user profile avatars</li>
 * </ul>
 */
@Service
public class MediaUploadService {

    private static final Set<String> ALLOWED_MIME_TYPES = Set.of(
            "image/jpeg", "image/jpg", "image/png", "image/webp"
    );

    private final Cloudinary cloudinary;
    private final long maxFileSizeBytes;
    private final String uploadFolder;

    public MediaUploadService(
            Cloudinary cloudinary,
            @Value("${media.max-file-size-mb:5}") int maxFileSizeMb,
            @Value("${media.upload-folder:TurfChai}") String uploadFolder) {
        this.cloudinary = cloudinary;
        this.maxFileSizeBytes = (long) maxFileSizeMb * 1024 * 1024;
        this.uploadFolder = uploadFolder;
    }

    /**
     * Upload a venue or pitch photo.
     *
     * @param file     the multipart file
     * @param venueId  venue identifier (used as sub-folder)
     * @return secure HTTPS URL of the uploaded image
     */
    public String uploadVenuePhoto(MultipartFile file, Long venueId) throws IOException {
        validate(file);
        String folder = "%s/venues/%d".formatted(uploadFolder, venueId);
        return doUpload(file, folder, "venue_" + venueId + "_" + System.currentTimeMillis());
    }

    /**
     * Upload a user avatar.
     *
     * @param file   the multipart file
     * @param userId user identifier
     * @return secure HTTPS URL of the uploaded image
     */
    public String uploadAvatar(MultipartFile file, Long userId) throws IOException {
        validate(file);
        String folder = "%s/avatars".formatted(uploadFolder);
        return doUpload(file, folder, "avatar_" + userId);
    }

    /**
     * Generic upload — stored under {@code TurfChai/general/}.
     *
     * @param file the multipart file
     * @return secure HTTPS URL
     */
    public String uploadGeneric(MultipartFile file) throws IOException {
        validate(file);
        String folder = "%s/general".formatted(uploadFolder);
        return doUpload(file, folder, "upload_" + System.currentTimeMillis());
    }

    // ── Internal ───────────────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private String doUpload(MultipartFile file, String folder, String publicId) throws IOException {
        Map<String, Object> params = ObjectUtils.asMap(
                "folder", folder,
                "public_id", publicId,
                "overwrite", true,
                "resource_type", "image",
                "quality", "auto",
                "fetch_format", "auto"
        );

        Map<String, Object> result = cloudinary.uploader().upload(file.getBytes(), params);
        String secureUrl = (String) result.get("secure_url");
        if (secureUrl == null || secureUrl.isBlank()) {
            throw new IOException("Cloudinary upload returned no URL");
        }
        return secureUrl;
    }

    private void validate(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("No file provided");
        }

        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_MIME_TYPES.contains(contentType.toLowerCase())) {
            throw new IllegalArgumentException(
                    "Invalid file type '%s'. Allowed: JPEG, PNG, WebP".formatted(contentType));
        }

        if (file.getSize() > maxFileSizeBytes) {
            long limitMb = maxFileSizeBytes / (1024 * 1024);
            throw new IllegalArgumentException(
                    "File size %.1f MB exceeds the %d MB limit".formatted(
                            file.getSize() / (1024.0 * 1024.0), limitMb));
        }
    }
}
