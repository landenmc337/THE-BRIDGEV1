console.log("✅ paintManager.js loaded");

function hexToRGBA(hex) {
    hex = hex.replace("#", "");

    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    const a = hex.length >= 8
        ? parseInt(hex.substring(6, 8), 16) / 255
        : 1;

    return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function buildPaint(paint) {
    console.log("🎨 Paint received:", paint);

    if (!paint) {
        console.log("❌ No paint object.");
        return null;
    }

    console.log("📦 Paint data:", paint.data);
    console.log("🧱 Paint layers:", paint.data?.layers);

    const layers = paint.data?.layers ?? [];

    if (!layers.length) {
        console.log("❌ No paint layers found!");
        return null;
    }

    const backgrounds = [];

    for (const layer of layers) {
        console.log("Layer:", layer);

        switch (layer.ty.__typename) {

            case "PaintLayerTypeSingleColor":
                backgrounds.push(hexToRGBA(layer.ty.color.hex));
                break;

            case "PaintLayerTypeLinearGradient": {
                const stops = layer.ty.stops
                    .map(stop => `${hexToRGBA(stop.color.hex)} ${stop.at * 100}%`)
                    .join(", ");

                backgrounds.push(
                    `${layer.ty.repeating ? "repeating-" : ""}linear-gradient(${layer.ty.angle || 180}deg, ${stops})`
                );
                break;
            }

            case "PaintLayerTypeRadialGradient": {
                const stops = layer.ty.stops
                    .map(stop => `${hexToRGBA(stop.color.hex)} ${stop.at * 100}%`)
                    .join(", ");

                backgrounds.push(
                    `${layer.ty.repeating ? "repeating-" : ""}radial-gradient(circle at center, ${stops})`
                );
                break;
            }

            case "PaintLayerTypeImage": {
                const image = layer.ty.images?.[0];

                if (image) {
                    backgrounds.push(`url("${image.url}")`);
                }

                break;
            }

            default:
                console.warn("⚠️ Unsupported paint layer:", layer.ty.__typename);
        }
    }

    let filter = "";

    if (paint.data?.shadows?.length) {
        filter = paint.data.shadows
            .map(shadow =>
                `drop-shadow(${shadow.offsetX}px ${shadow.offsetY}px ${shadow.blur}px ${hexToRGBA(shadow.color.hex)})`
            )
            .join(" ");
    }

    const style = {
        backgroundImage: backgrounds.join(", "),
        backgroundSize: "100% 100%",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",

        WebkitBackgroundClip: "text",
        backgroundClip: "text",
        WebkitTextFillColor: "transparent",

        filter
    };

    console.log("✅ Generated style:", style);

    return style;
}

window.buildPaint = buildPaint;