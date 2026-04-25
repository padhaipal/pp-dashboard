import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt =
  "What if every Indian child could read? Take the PadhaiPal 5-question quiz.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const logoSvg = await readFile(
    join(process.cwd(), "public/padhaipal-logo.svg"),
  );
  const logoSrc = `data:image/svg+xml;base64,${logoSvg.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "white",
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          padding: "60px 80px",
          gap: "60px",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoSrc}
          alt="PadhaiPal"
          width={360}
          height={360}
          style={{ flexShrink: 0 }}
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
          }}
        >
          <div
            style={{
              fontSize: 28,
              color: "#1683BC",
              letterSpacing: 4,
              textTransform: "uppercase",
              fontWeight: 700,
              marginBottom: 14,
            }}
          >
            PadhaiPal Quiz
          </div>
          <div
            style={{
              fontSize: 64,
              color: "#21243d",
              fontWeight: 700,
              lineHeight: 1.1,
              marginBottom: 24,
            }}
          >
            What if every Indian child could read?
          </div>
          <div
            style={{
              fontSize: 30,
              color: "#52525b",
              lineHeight: 1.35,
            }}
          >
            Take the 5-question quiz — guess, then see what the research says.
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}