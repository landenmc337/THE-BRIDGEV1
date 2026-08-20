console.log("✅ 7TV paintManager.js loaded");


/*
 * ============================================================
 * The Bridge4K
 * 7TV Namepaint Renderer
 *
 * Designed to mirror 7TV's paint rendering behavior.
 *
 * Supports:
 * - Current PaintData layers
 * - Legacy PaintData gradients
 * - Single colors
 * - Linear gradients
 * - Radial gradients
 * - Image layers
 * - Gradient stops
 * - Gradient positioning
 * - Gradient sizing
 * - Gradient repeat
 * - Layer opacity
 * - Paint drop shadows
 * - Text stroke
 * - Text shadow
 * - Text transform
 * - Font weight
 * ============================================================
 */


// ============================================================
// Color Helpers
// ============================================================

function colorToRGBA(color, opacity = 1) {

    if (!color) {
        return `rgba(0, 0, 0, ${opacity})`;
    }


    // --------------------------------------------------------
    // String color
    // --------------------------------------------------------

    if (typeof color === "string") {

        let hex =
            color
                .replace("#", "")
                .trim();


        if (
            hex.length === 3
        ) {

            hex =
                hex
                    .split("")
                    .map(
                        char =>
                            char + char
                    )
                    .join("");
        }


        const r =
            parseInt(
                hex.substring(0, 2),
                16
            ) || 0;


        const g =
            parseInt(
                hex.substring(2, 4),
                16
            ) || 0;


        const b =
            parseInt(
                hex.substring(4, 6),
                16
            ) || 0;


        let a = 1;


        if (
            hex.length >= 8
        ) {

            a =
                (
                    parseInt(
                        hex.substring(6, 8),
                        16
                    ) || 255
                ) / 255;
        }


        a *= opacity;


        return `rgba(${r}, ${g}, ${b}, ${a})`;
    }


    // --------------------------------------------------------
    // 7TV Color object
    // --------------------------------------------------------

    const r =
        Number(
            color.r
        ) || 0;


    const g =
        Number(
            color.g
        ) || 0;


    const b =
        Number(
            color.b
        ) || 0;


    let a = 1;


    if (
        typeof color.a ===
        "number"
    ) {

        /*
         * 7TV Color.a is normally 0-255.
         *
         * Some legacy data may use 0-1.
         */

        a =
            color.a > 1
                ? color.a / 255
                : color.a;
    }


    a *= opacity;


    return `rgba(${r}, ${g}, ${b}, ${a})`;
}


// ============================================================
// Clamp
// ============================================================

function clamp(
    value,
    minimum = 0,
    maximum = 1
) {

    const number =
        Number(
            value
        );


    if (
        !Number.isFinite(number)
    ) {

        return minimum;
    }


    return Math.min(
        maximum,
        Math.max(
            minimum,
            number
        )
    );
}


// ============================================================
// Gradient Stop
// ============================================================

function buildGradientStop(
    stop,
    opacity = 1
) {

    const color =
        colorToRGBA(
            stop?.color,
            opacity
        );


    const position =
        clamp(
            stop?.at ?? 0
        ) * 100;


    return `${color} ${position}%`;
}


// ============================================================
// Current 7TV Linear Gradient
// ============================================================

function buildLinearGradient(
    gradient,
    opacity = 1
) {

    const stops =
        Array.isArray(
            gradient?.stops
        )
            ? gradient.stops
                .map(
                    stop =>
                        buildGradientStop(
                            stop,
                            opacity
                        )
                )
                .join(", ")
            : "";


    const prefix =
        gradient?.repeating
            ? "repeating-"
            : "";


    const angle =
        Number.isFinite(
            Number(
                gradient?.angle
            )
        )
            ? Number(
                gradient.angle
            )
            : 0;


    return (
        `${prefix}linear-gradient(` +
        `${angle}deg, ${stops}` +
        `)`
    );
}


// ============================================================
// Current 7TV Radial Gradient
// ============================================================

function buildRadialGradient(
    gradient,
    opacity = 1
) {

    const stops =
        Array.isArray(
            gradient?.stops
        )
            ? gradient.stops
                .map(
                    stop =>
                        buildGradientStop(
                            stop,
                            opacity
                        )
                )
                .join(", ")
            : "";


    const prefix =
        gradient?.repeating
            ? "repeating-"
            : "";


    const shape =
        String(
            gradient?.shape ||
            "CIRCLE"
        ).toLowerCase();


    return (
        `${prefix}radial-gradient(` +
        `${shape}, ${stops}` +
        `)`
    );
}


// ============================================================
// Current 7TV Image Layer
// ============================================================

function buildImageLayer(
    layer,
    opacity = 1
) {

    const image =
        layer?.images?.[0];


    if (
        !image?.url
    ) {

        return null;
    }


    /*
     * Image paints are rendered as a background image.
     *
     * Preserve the URL exactly as supplied by 7TV.
     */

    return (
        `url("${String(
            image.url
        ).replace(
            /"/g,
            '\\"'
        )}")`
    );
}


// ============================================================
// Current Paint Layer
// ============================================================

function buildCurrentLayer(
    layer
) {

    if (
        !layer?.ty
    ) {

        return null;
    }


    const type =
        layer.ty;


    const opacity =
        clamp(
            layer.opacity ===
            undefined
                ? 1
                : layer.opacity
        );


    switch (
        type.__typename
    ) {

        // ----------------------------------------------------
        // Solid Color
        // ----------------------------------------------------

        case "PaintLayerTypeSingleColor": {

            const color =
                colorToRGBA(
                    type.color,
                    opacity
                );


            /*
             * Use a solid linear gradient so the layer can
             * participate in the same background stack.
             */

            return {
                image:
                    `linear-gradient(` +
                    `${color}, ${color}` +
                    `)`,

                position:
                    "0% 0%",

                size:
                    "100% 100%",

                repeat:
                    "no-repeat"
            };
        }


        // ----------------------------------------------------
        // Linear Gradient
        // ----------------------------------------------------

        case "PaintLayerTypeLinearGradient": {

            return {
                image:
                    buildLinearGradient(
                        type,
                        opacity
                    ),

                position:
                    "0% 0%",

                /*
                 * 7TV's gradient renderer does not stretch
                 * every gradient to 100% x 100%.
                 *
                 * Cover gives the same visual behavior for
                 * the current layer format.
                 */

                size:
                    "cover",

                repeat:
                    type.repeating
                        ? "repeat"
                        : "no-repeat"
            };
        }


        // ----------------------------------------------------
        // Radial Gradient
        // ----------------------------------------------------

        case "PaintLayerTypeRadialGradient": {

            return {
                image:
                    buildRadialGradient(
                        type,
                        opacity
                    ),

                position:
                    "0% 0%",

                size:
                    "cover",

                repeat:
                    type.repeating
                        ? "repeat"
                        : "no-repeat"
            };
        }


        // ----------------------------------------------------
        // Image
        // ----------------------------------------------------

        case "PaintLayerTypeImage": {

            const image =
                buildImageLayer(
                    type,
                    opacity
                );


            if (!image) {
                return null;
            }


            return {
                image,

                position:
                    "0% 0%",

                size:
                    "cover",

                repeat:
                    "no-repeat"
            };
        }


        default:

            console.warn(
                "⚠️ Unsupported 7TV paint layer:",
                type.__typename
            );


            return null;
    }
}


// ============================================================
// Legacy 7TV Gradient
// ============================================================

function buildLegacyGradient(
    gradient
) {

    if (!gradient) {
        return null;
    }


    const functionName =
        String(
            gradient.function ||
            "LINEAR_GRADIENT"
        )
            .toLowerCase()
            .replace(
                "_",
                "-"
            );


    // --------------------------------------------------------
    // Image
    // --------------------------------------------------------

    if (
        functionName ===
        "url"
    ) {

        if (
            !gradient.image_url
        ) {

            return null;
        }


        return {
            image:
                `url("${String(
                    gradient.image_url
                ).replace(
                    /"/g,
                    '\\"'
                )}")`,

            position:
                gradient.at?.length === 2
                    ? `${gradient.at[0] * 100}% ${gradient.at[1] * 100}%`
                    : "0% 0%",

            size:
                gradient.size?.length === 2
                    ? `${gradient.size[0] * 100}% ${gradient.size[1] * 100}%`
                    : "",

            repeat:
                gradient.canvas_repeat ||
                "unset"
        };
    }


    const args = [];


    // --------------------------------------------------------
    // Linear
    // --------------------------------------------------------

    if (
        functionName ===
        "linear-gradient"
    ) {

        args.push(
            `${
                typeof gradient.angle ===
                "number"
                    ? gradient.angle
                    : 0
            }deg`
        );
    }


    // --------------------------------------------------------
    // Radial
    // --------------------------------------------------------

    if (
        functionName ===
        "radial-gradient"
    ) {

        args.push(
            String(
                gradient.shape ||
                "circle"
            ).toLowerCase()
        );
    }


    // --------------------------------------------------------
    // Stops
    // --------------------------------------------------------

    for (
        const stop of
        gradient.stops ||
        []
    ) {

        args.push(
            buildGradientStop(
                stop
            )
        );
    }


    const prefix =
        gradient.repeat
            ? "repeating-"
            : "";


    return {

        image:
            `${prefix}${functionName}(` +
            `${args.join(", ")}` +
            `)`,

        position:
            gradient.at?.length === 2
                ? `${gradient.at[0] * 100}% ${gradient.at[1] * 100}%`
                : "",

        size:
            gradient.size?.length === 2
                ? `${gradient.size[0] * 100}% ${gradient.size[1] * 100}%`
                : "",

        repeat:
            gradient.canvas_repeat ||
            "unset"
    };
}


// ============================================================
// Paint Shadow
// ============================================================

function buildShadow(
    shadow
) {

    if (!shadow) {
        return null;
    }


    /*
     * Current 7TV format:
     *
     * offsetX
     * offsetY
     * blur
     * color
     *
     * Legacy format:
     *
     * x_offset
     * y_offset
     * radius
     * color
     */

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


    return (
        `drop-shadow(` +
        `${x}px ` +
        `${y}px ` +
        `${blur}px ` +
        `${colorToRGBA(
            shadow.color
        )}` +
        `)`
    );
}


// ============================================================
// Build Paint
// ============================================================

function buildPaint(
    paint
) {

    console.log(
        "🎨 7TV Paint received:",
        paint
    );


    if (!paint) {

        console.log(
            "❌ No 7TV paint object."
        );


        return null;
    }


    const data =
        paint.data;


    if (!data) {

        console.log(
            "❌ Paint has no data."
        );


        return null;
    }


    console.log(
        "📦 7TV Paint data:",
        data
    );


    const backgrounds = [];
    const positions = [];
    const sizes = [];
    const repeats = [];


    // ========================================================
    // Current 7TV PaintData
    // ========================================================

    if (
        Array.isArray(
            data.layers
        ) &&
        data.layers.length
    ) {

        for (
            const layer of
            data.layers
        ) {

            const result =
                buildCurrentLayer(
                    layer
                );


            if (!result) {
                continue;
            }


            backgrounds.push(
                result.image
            );


            positions.push(
                result.position
            );


            sizes.push(
                result.size
            );


            repeats.push(
                result.repeat
            );
        }
    }


    // ========================================================
    // Legacy 7TV PaintData
    // ========================================================

    else if (
        Array.isArray(
            data.gradients
        ) &&
        data.gradients.length
    ) {

        for (
            const gradient of
            data.gradients
        ) {

            const result =
                buildLegacyGradient(
                    gradient
                );


            if (!result) {
                continue;
            }


            backgrounds.push(
                result.image
            );


            positions.push(
                result.position
            );


            sizes.push(
                result.size
            );


            repeats.push(
                result.repeat
            );
        }
    }


    // ========================================================
    // Legacy single-gradient fallback
    // ========================================================

    else if (
        data.function
    ) {

        const gradient = {
            function:
                data.function,

            canvas_repeat:
                data.canvas_repeat ||
                "",

            size:
                data.size ||
                [1, 1],

            shape:
                data.shape,

            image_url:
                data.image_url,

            stops:
                data.stops ||
                [],

            repeat:
                data.repeat ||
                false,

            angle:
                data.angle,

            at:
                data.at
        };


        const result =
            buildLegacyGradient(
                gradient
            );


        if (result) {

            backgrounds.push(
                result.image
            );


            positions.push(
                result.position
            );


            sizes.push(
                result.size
            );


            repeats.push(
                result.repeat
            );
        }
    }


    // ========================================================
    // Nothing Renderable
    // ========================================================

    if (
        !backgrounds.length
    ) {

        console.warn(
            "⚠️ 7TV paint contains no renderable layers."
        );


        return null;
    }


    // ========================================================
    // Drop Shadows
    // ========================================================

    const filters =
        Array.isArray(
            data.shadows
        )
            ? data.shadows
                .map(
                    buildShadow
                )
                .filter(
                    Boolean
                )
                .join(" ")
            : "";


    // ========================================================
    // Text Effects
    // ========================================================

    const text =
        data.text;


    const style = {

    backgroundImage:
        backgrounds.join(", "),

    backgroundPosition:
        positions.join(", "),

    backgroundSize:
        sizes.join(", "),

    backgroundRepeat:
        repeats.join(", "),

    WebkitBackgroundClip:
        "text",

    backgroundClip:
        "text",

    WebkitTextFillColor:
        "transparent",

    color:
        "transparent",

    filter:
        filters || "none"
};


    // ========================================================
    // Paint Base Color
    // ========================================================

    
    // ========================================================
    // Text Styling
    // ========================================================

    if (
        text
    ) {

        // ----------------------------------------------------
        // Font Weight
        // ----------------------------------------------------

        if (
            text.weight !==
            undefined
        ) {

            style.fontWeight =
                Number(
                    text.weight
                ) * 100;
        }


        // ----------------------------------------------------
        // Text Stroke
        // ----------------------------------------------------

        if (
            text.stroke
        ) {

            style.WebkitTextStrokeWidth =
                `${Number(
                    text.stroke.width
                ) || 0}px`;


            style.WebkitTextStrokeColor =
                colorToRGBA(
                    text.stroke.color
                );
        }


        // ----------------------------------------------------
        // Text Shadows
        // ----------------------------------------------------

        if (
            Array.isArray(
                text.shadows
            )
        ) {

            style.textShadow =
                text.shadows
                    .map(
                        shadow => {

                            const x =
                                Number(
                                    shadow.x_offset
                                ) || 0;


                            const y =
                                Number(
                                    shadow.y_offset
                                ) || 0;


                            const radius =
                                Number(
                                    shadow.radius
                                ) || 0;


                            return (
                                `${x}px ` +
                                `${y}px ` +
                                `${radius}px ` +
                                `${colorToRGBA(
                                    shadow.color
                                )}`
                            );
                        }
                    )
                    .join(", ");
        }


        // ----------------------------------------------------
        // Text Transform
        // ----------------------------------------------------

        if (
            text.transform
        ) {

            style.textTransform =
                text.transform;
        }
    }


    console.log(
        "✅ Generated 7TV-compatible paint style:",
        style
    );


    return style;
}


// ============================================================
// Export
// ============================================================

window.buildPaint =
    buildPaint;