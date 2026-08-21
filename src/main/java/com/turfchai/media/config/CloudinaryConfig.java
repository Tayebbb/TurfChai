package com.turfchai.media.config;

import com.cloudinary.Cloudinary;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Configures the Cloudinary SDK bean from the CLOUDINARY_URL environment variable
 * (format {@code cloudinary://API_KEY:API_SECRET@CLOUD_NAME}).
 *
 * <p>The variable is optional so the app still boots without it; an unconfigured
 * client simply fails when an upload is attempted.
 */
@Configuration
public class CloudinaryConfig {

    @Value("${cloudinary.url:}")
    private String cloudinaryUrl;

    @Bean
    public Cloudinary cloudinary() {
        return cloudinaryUrl != null && cloudinaryUrl.trim().startsWith("cloudinary://")
                ? new Cloudinary(cloudinaryUrl.trim())
                : new Cloudinary();
    }
}
