import { ImageResponse } from "next/og";

export const alt = "PolarLink · Integrated Polar Expedition Logistics";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0a0a0a",
          color: "#fafafa",
          padding: "80px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <div
            style={{
              display: "flex",
              width: "64px",
              height: "64px",
              borderRadius: "16px",
              background: "#fafafa",
              color: "#0a0a0a",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "28px",
              fontWeight: 700,
            }}
          >
            PL
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: "40px", fontWeight: 700 }}>PolarLink</div>
            <div style={{ fontSize: "20px", color: "#a1a1aa" }}>NCPOR · MoES</div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ fontSize: "56px", fontWeight: 700, lineHeight: 1.1 }}>
            Integrated Polar Expedition Logistics
          </div>
          <div style={{ fontSize: "24px", color: "#a1a1aa" }}>
            Cargo custody · autonomy · evacuation · offline sync
          </div>
        </div>
        <div style={{ display: "flex", fontSize: "22px", color: "#71717a" }}>
          Problem statement 26062 · 46-ISEA synthetic seed
        </div>
      </div>
    ),
    { ...size }
  );
}
