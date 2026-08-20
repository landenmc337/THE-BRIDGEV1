console.log("✅ 7TV paint renderer loaded");

/*
 * TheBridge4K 7TV Namepaint renderer
 *
 * This renderer follows 7TV's paint model:
 * - paint.data.layers
 * - per-layer opacity
 * - single-color layers
 * - linear gradients
 * - radial gradients
 * - repeating gradients
 * - image layers
 * - paint shadows
 *
 * It also keeps support for the legacy 7TV `data.gradients` format.
 *
 * Important:
 * 7TV's official extension does NOT force every paint to
 * background-size: 100% 100%. That was one of the main reasons
 * Bridge4K paints could look different.
 */

function clamp(value, min = 0, max = 1) {
    return Math.min(max, Math.max(min, Number(value) || 0));
}

function hexToRGBA(hex, opacity = 1) {
    if (!hex) {
        return `rgba(0, 0, 0, ${clamp(opacity)})`;
    }

    let value = String(hex).replace("#", "");

    if (value.length === 3) {
        value = value
            .split("")
            .map(char => char + char)
            .join("");
    }

    const r = parseInt(value.substring(0, 2), 16) || 0;
    const g = parseInt(value.substring(2, 4), 16) || 0;
    const b = parseInt(value.substring(4, 6), 16) || 0;

    let alpha = 1;

    if (value.length >= 8) {
        alpha = parseInt(value.substring(6, 8), 16) / 255;
    }

    alpha *= clamp(opacity);

    if (alpha >= 0.999) {
        return `rgb(${r}, ${g}, ${b})`;
    }

    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function colorObjectToRGBA(color, opacity = 1) {
    if (!color) {
        return `rgba(0, 0, 0, ${clamp(opacity)})`;
    }

    if (typeof color === "string") {
        return hexToRGBA(color, opacity);
    }

    if (typeof color.hex === "string") {
        return hexToRGBA(color.hex, opacity);
    }

    const r = Number(color.r) || 0;
    const g = Number(color.g) || 0;
    const b = Number(color.b) || 0;

    /*
     * 7TV's current Color object stores alpha as 0-255.
     * Legacy data may already provide a 0-1 alpha.
     */
    let alpha =
        typeof color.a === "number"
            ? color.a > 1
                ? color.a / 255
                : color.a
            : 1;

    alpha *= clamp(opacity);

    if (alpha >= 0.999) {
        return `rgb(${r}, ${g}, ${b})`;
    }

    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function normalizeStop(stop, opacity = 1) {
    return `${colorObjectToRGBA(stop?.color, opacity)} ${clamp(stop?.at) * 100}%`;
}

function buildLinearGradient(layerType, layerOpacity) {
    const stops = Array.isArray(layerType.stops)
        ? layerType.stops
            .map(stop => normalizeStop(stop, layerOpacity))
            .join(", ")
        : "";

    const prefix = layerType.repeating
        ? "repeating-"
        : "";

    const angle =
        typeof layerType.angle === "number"
            ? layerType.angle
            : 0;

    return `${prefix}linear-gradient(${angle}deg, ${stops})`;
}

function buildRadialGradient(layerType, layerOpacity) {
    const stops = Array.isArray(layerType.stops)
        ? layerType.stops
            .map(stop => normalizeStop(stop, layerOpacity))
            .join(", ")
        : "";

    const prefix = layerType.repeating
        ? "repeating-"
        : "";

    const shape =
        String(layerType.shape || "CIRCLE").toLowerCase() === "ellipse"
            ? "ellipse"
            : "circle";

    return `${prefix}radial-gradient(${shape}, ${stops})`;
}

function buildImageLayer(layerType, layerOpacity) {
    const image = Array.isArray(layerType.images)
        ? layerType.images[0]
        : null;

    if (!image?.url) {
        return null;
    }

    /*
     * CSS cannot apply opacity to one background image independently.
     * For normal 7TV image paints the layer opacity is generally 1.
     * When opacity is below 1, use an SVG wrapper for static images.
     * Animated images are left as normal URLs because converting them
     * would destroy animation.
     */
    if (
        layerOpacity < 0.999 &&
        Number(image.frameCount || 1) <= 1
    ) {
        const escapedUrl = String(image.url)
            .replace(/&/g, "&amp;")
            .replace(/"/g, "&quot;")
            .replace(/</g, "%3C")
            .replace(/>/g, "%3E");

        const svg =
            `<svg xmlns="http://www.w3.org/2000/svg" ` +
            `width="100%" height="100%" viewBox="0 0 100 100">` +
            `<image href="${escapedUrl}" x="0" y="0" ` +
            `width="100" height="100" preserveAspectRatio="none" ` +
            `opacity="${clamp(layerOpacity)}"/>` +
            `</svg>`;

        return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
    }

    return `url("${String(image.url).replace(/"/g, '\\"')}")`;
}

function buildCurrentPaint(paint) {
    const layers = paint?.data?.layers;

    if (!Array.isArray(layers) || !layers.length) {
        return null;
    }

    const backgrounds = [];

    /*
     * CSS background layers are painted from first -> last, with the
     * first image being the topmost layer. This matches 7TV's layer
     * ordering for the paint stack.
     */
    for (const layer of layers) {
        const type = layer?.ty;

        if (!type) {
            continue;
        }

        const opacity = clamp(
            layer.opacity === undefined
                ? 1
                : layer.opacity
        );

        let background = null;

        switch (type.__typename) {
            case "PaintLayerTypeSingleColor":
                /*
                 * A solid layer is represented as a gradient so it can
                 * participate in the same background-image stack.
                 */
                background =
                    `linear-gradient(` +
                    `${colorObjectToRGBA(type.color, opacity)}, ` +
                    `${colorObjectToRGBA(type.color, opacity)}` +
                    `)`;
                break;

            case "PaintLayerTypeLinearGradient":
                background = buildLinearGradient(
                    type,
                    opacity
                );
                break;

            case "PaintLayerTypeRadialGradient":
                background = buildRadialGradient(
                    type,
                    opacity
                );
                break;

            case "PaintLayerTypeImage":
                background = buildImageLayer(
                    type,
                    opacity
                );
                break;

            default:
                console.warn(
                    "⚠️ Unsupported 7TV paint layer:",
                    type.__typename
                );
                break;
        }

        if (background) {
            backgrounds.push(background);
        }
    }

    if (!backgrounds.length) {
        return null;
    }

    const shadow =
        Array.isArray(paint.data.shadows)
            ? paint.data.shadows
                .map(buildShadow)
                .filter(Boolean)
                .join(" ")
            : "";

    return {
        backgroundColor: "currentColor",

        backgroundImage:
            backgrounds.join(", "),

        /*
         * Do NOT force 100% 100%.
         */
        backgroundSize:
            backgrounds.map(() => "auto").join(", "),

        backgroundPosition:
            backgrounds.map(() => "0% 0%").join(", "),

        backgroundRepeat:
            backgrounds.map(() => "repeat").join(", "),

        WebkitBackgroundClip: "text",
        backgroundClip: "text",

        WebkitTextFillColor: "transparent",

        filter:
            shadow || "none"
    };
}

function buildLegacyGradient(gradient) {
    if (!gradient) {
        return null;
    }

    const fn =
        String(
            gradient.function ||
            "LINEAR_GRADIENT"
        )
            .toLowerCase()
            .replace("_", "-");

    if (fn === "url") {
        return gradient.image_url
            ? `url("${String(gradient.image_url).replace(/"/g, '\\"')}")`
            : null;
    }

    const args = [];

    if (fn === "linear-gradient") {
        args.push(
            `${typeof gradient.angle === "number" ? gradient.angle : 0}deg`
        );
    } else if (fn === "radial-gradient") {
        args.push(
            String(
                gradient.shape || "circle"
            ).toLowerCase()
        );
    }

    for (const stop of gradient.stops || []) {
        args.push(
            `${colorObjectToRGBA(stop.color)} ${clamp(stop.at) * 100}%`
        );
    }

    const prefix = gradient.repeat
        ? "repeating-"
        : "";

    return `${prefix}${fn}(${args.join(", ")})`;
}

function buildShadow(shadow) {
    if (!shadow) {
        return null;
    }

    const x =
        Number(
            shadow.offsetX ??
            shadow.x_offset ??
            0
        );

    const y =
        Number(
            shadow.offsetY ??
            shadow.y_offset ??
            0
        );

    const blur =
        Number(
            shadow.blur ??
            shadow.radius ??
            0
        );

    /*
     * 7TV paint shadows can be quite strong when rendered
     * directly through CSS drop-shadow().
     *
     * Keep the original position and blur, but reduce the
     * shadow opacity so the paint retains the subtle glow
     * seen in the native 7TV renderer.
     */
    return `drop-shadow(` +
        `${x}px ${y}px ${blur}px ` +
        `${colorObjectToRGBA(shadow.color, 0.45)}` +
        `)`;
}

function buildLegacyPaint(paint) {
    const gradients =
        paint?.data?.gradients;

    if (!Array.isArray(gradients) || !gradients.length) {
        return null;
    }

    const backgroundImages = [];
    const positions = [];
    const sizes = [];
    const repeats = [];

    for (const gradient of gradients) {
        const image =
            buildLegacyGradient(gradient);

        if (!image) {
            continue;
        }

        backgroundImages.push(image);

        positions.push(
            gradient.at?.length === 2
                ? `${gradient.at[0] * 100}% ${gradient.at[1] * 100}%`
                : "0% 0%"
        );

        sizes.push(
            gradient.size?.length === 2
                ? `${gradient.size[0] * 100}% ${gradient.size[1] * 100}%`
                : "auto"
        );

        repeats.push(
            gradient.canvas_repeat || "unset"
        );
    }

    if (!backgroundImages.length) {
        return null;
    }

    const filter =
        Array.isArray(paint.data.shadows)
            ? paint.data.shadows
                .map(buildShadow)
                .filter(Boolean)
                .join(" ")
            : "";

    const style = {
        backgroundColor: "currentColor",

        backgroundImage:
            backgroundImages.join(", "),

        backgroundPosition:
            positions.join(", "),

        backgroundSize:
            sizes.join(", "),

        backgroundRepeat:
            repeats.join(", "),

        WebkitBackgroundClip: "text",
        backgroundClip: "text",

        WebkitTextFillColor: "transparent",

        filter:
            filter || "none"
    };

    if (paint.data.color) {
        style.color =
            colorObjectToRGBA(
                paint.data.color
            );
    }

    if (paint.data.text) {
        const text = paint.data.text;

        if (text.weight) {
            style.fontWeight =
                Number(text.weight) * 100;
        }

        if (text.stroke) {
            style.WebkitTextStrokeWidth =
                `${Number(text.stroke.width) || 0}px`;

            style.WebkitTextStrokeColor =
                colorObjectToRGBA(
                    text.stroke.color
                );
        }

        if (Array.isArray(text.shadows)) {
            style.textShadow =
                text.shadows
                    .map(shadow =>
                        `${Number(shadow.x_offset) || 0}px ` +
                        `${Number(shadow.y_offset) || 0}px ` +
                        `${Number(shadow.radius) || 0}px ` +
                        `${colorObjectToRGBA(shadow.color)}`
                    )
                    .join(", ");
        }

        if (text.transform) {
            style.textTransform =
                text.transform;
        }
    }

    return style;
}

function buildPaint(paint) {
    if (!paint) {
        return null;
    }

    /*
     * Prefer current 7TV GraphQL PaintData.
     * Fall back to legacy gradients.
     */
    const style =
        Array.isArray(paint?.data?.layers)
            ? buildCurrentPaint(paint)
            : buildLegacyPaint(paint);

    if (!style) {
        console.warn(
            "⚠️ 7TV paint contained no renderable layers:",
            paint
        );

        return null;
    }

    return style;
}

window.buildPaint = buildPaint;