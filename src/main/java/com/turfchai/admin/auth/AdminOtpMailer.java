package com.turfchai.admin.auth;

import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Component;

/**
 * Delivers the admin 2FA code by email.
 *
 * When no SMTP host is configured, Spring Boot does not create a
 * {@link JavaMailSender} bean and this component is a safe no-op — the code is
 * then only returned as {@code devCode} (demo mode).
 */
@Component
public class AdminOtpMailer {

    private static final Logger log = LoggerFactory.getLogger(AdminOtpMailer.class);

    private final ObjectProvider<JavaMailSender> mailSenderProvider;
    private final String smtpHost;

    public AdminOtpMailer(
            ObjectProvider<JavaMailSender> mailSenderProvider,
            @org.springframework.beans.factory.annotation.Value("${spring.mail.host:}") String smtpHost) {
        this.mailSenderProvider = mailSenderProvider;
        this.smtpHost = smtpHost;
    }

    public void sendLoginCode(String email, String code, long ttlSeconds) {
        if (smtpHost == null || smtpHost.isBlank()) {
            log.info("SMTP not configured; 2FA code for {} only available as devCode", maskEmail(email));
            return;
        }
        JavaMailSender sender = mailSenderProvider.getIfUnique();
        if (sender == null) {
            log.info("No JavaMailSender bean; 2FA code for {} only available as devCode", maskEmail(email));
            return;
        }
        try {
            MimeMessage message = sender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, "UTF-8");
            helper.setTo(email);
            helper.setSubject("TurfChai Admin — Your one-time login code");
            helper.setText(
                    "Your TurfChai admin login code is: " + code + "\n\n"
                            + "It expires in " + ttlSeconds + " seconds.\n"
                            + "If you did not try to sign in, ignore this email.\n\n"
                            + "— TurfChai Admin Console",
                    false);
            sender.send(message);
            log.info("2FA code emailed to {}", maskEmail(email));
        } catch (Exception e) {
            log.warn("Failed to email 2FA code to {}: {}", maskEmail(email), e.getMessage());
        }
    }

    private String maskEmail(String email) {
        if (email == null || !email.contains("@")) return "***";
        String local = email.substring(0, email.indexOf('@'));
        String domain = email.substring(email.indexOf('@'));
        if (local.length() <= 2) return local.charAt(0) + "***" + domain;
        return local.substring(0, 1) + "••••" + local.substring(local.length() - 1) + domain;
    }
}