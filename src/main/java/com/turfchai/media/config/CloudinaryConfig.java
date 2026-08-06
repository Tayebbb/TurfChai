package com.turfchai.media.config;

import com.cloudinary.Cloudinary;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Configures the Cloudinary SDK bean using the CLOUDINARY_URL environment variable.
 *
 * <p>Expected format:
 * {@code cloudinary://API_KEY:API_SECRET@CLOUD_NAME}
 *
 * <p>Set in environment:
 * {@code CLOUDINARY_URL=cloudinary://311877841418845:vz_QB0gHkX9_RVXgC0CnmeFZdMk@dait0sacc}
 */
@Configuration
public class CloudinaryConfig {

    @Value("${cloudinary.url}")
    private String cloudinaryUrl;

    @Bean
    public Cloudinary cloudinary() {
        return new Cloudinary(cloudinaryUrl);
    }
}
