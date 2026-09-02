package com.turfchai.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.web.servlet.resource.PathResourceResolver;

import java.io.IOException;
import java.time.Duration;
import java.util.List;

/**
 * Single-origin deployment: the built React bundle lives in
 * {@code classpath:/static/} (copied in by the Docker build) and this config
 * turns the jar into the web server for it.
 *
 * <p>Resolution order for a path with no controller mapping:
 * <ol>
 *   <li>A real file in the bundle (hashed Vite assets, {@code ai-chat.html},
 *       favicon) — served with the default static-resource behaviour.</li>
 *   <li>Otherwise a client-side route — the browser must receive
 *       {@code index.html} (HTTP 200, not a 404) so React Router can restore
 *       the path from {@code window.location.pathname}. Without this, deep
 *       links like {@code /admin} and hard refreshes on any nested route
 *       404 — the exact failure the split Vercel + Render deployment had.</li>
 *   <li>Anything else stays a 404 so broken asset URLs surface as errors in
 *       the console instead of silently returning the app shell.</li>
 * </ol>
 *
 * <p>API paths ({@code /api/**}, {@code /v3/api-docs/**}, {@code /swagger-ui/**},
 * {@code /actuator/**}) always have controller mappings, and controller routing
 * runs before resource resolution, so none of this is ever consulted for them.
 */
@Configuration
public class SpaConfig implements WebMvcConfigurer {

    /** Top-level URL segments the React router owns (see AppRoutes.jsx). */
    private static final List<String> CLIENT_ROUTES = List.of(
            "/", "/admin", "/auth", "/host", "/owner", "/player", "/solo");

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        // Hashed Vite bundles under /assets/ are content-addressed: they are
        // safe to cache hard, and doing so is what makes repeat visits fast.
        registry.addResourceHandler("/assets/**")
                .addResourceLocations("classpath:/static/assets/")
                .setCacheControl(CacheControl.maxAge(Duration.ofDays(365)).immutable());

        registry.addResourceHandler("/**")
                .addResourceLocations("classpath:/static/")
                .resourceChain(true)
                .addResolver(new PathResourceResolver() {
                    @Override
                    protected Resource getResource(String resourcePath, Resource location)
                            throws IOException {
                        Resource requested = location.createRelative(resourcePath);
                        if (requested.exists() && requested.isReadable()) {
                            return requested;
                        }
                        // A path with no file and no extension is a client-side
                        // route (deep or not): hand the router its entry point.
                        // When the jar was built without the bundle the entry
                        // point is absent, and null keeps the 404 honest.
                        if (!resourcePath.contains(".") && isClientRoute("/" + resourcePath)) {
                            Resource index = new ClassPathResource("/static/index.html");
                            if (index.exists() && index.isReadable()) {
                                return index;
                            }
                        }
                        return null;
                    }

                    /**
                     * Exact segment-prefix match: {@code /admin}, {@code /admin/…},
                     * {@code /} — never {@code /api/…} or any other top-level
                     * path that merely starts with the same characters. A plain
                     * {@code startsWith} would let "/" swallow every request,
                     * including authenticated API calls that should 404.
                     */
                    private boolean isClientRoute(String path) {
                        if (path.equals("/") || path.isEmpty()) {
                            return true;
                        }
                        for (String route : CLIENT_ROUTES) {
                            if (route.equals("/") ) {
                                continue;
                            }
                            if (path.equals(route) || path.startsWith(route + "/")) {
                                return true;
                            }
                        }
                        return false;
                    }
                });
    }
}
