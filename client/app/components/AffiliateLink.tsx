"use client";

import { IS_CUBING_CONTESTS_INSTANCE } from "~/helpers/constants";
import { logAffiliateLinkClickSF } from "~/server/serverFunctions/serverFunctions.ts";

const height = 192 / 2;
const width = 1920 / 2;
const className = "d-flex justify-content-center w-100 max-w-100 mb-3";
const style = { overflow: "clip", backgroundColor: "#151515" };
const bannersUrlPath = `${process.env.NEXT_PUBLIC_STORAGE_PUBLIC_BUCKET_BASE_URL}/assets/banners`;

type Props = {
  type: "3x3" | "2x2" | "wca" | "fto" | "mirror" | "kilominx" | "other";
};

function AffiliateLink({ type }: Props) {
  if (!IS_CUBING_CONTESTS_INSTANCE) return;

  const logAffiliateLinkClick = (utmCampaign: string) => {
    logAffiliateLinkClickSF({ message: `Affiliate link clicked (utm_campaign: ${utmCampaign})` });
  };

  switch (type) {
    case "3x3":
      return (
        <a
          href="https://cuboss.com/product-category/3x3-speedcubes/?r=cubingcontests&utm_source=cubingcontests&utm_campaign=3x31125"
          target="_blank"
          rel="noopener"
          onClick={() => logAffiliateLinkClick("3x31125")}
          className={className}
          style={style}
        >
          <img src={`${bannersUrlPath}/3x3.jpg`} height={height} width={width} alt="Cuboss ad for 3x3x3 puzzles" />
        </a>
      );
    case "2x2":
      return (
        <a
          href="https://cuboss.com/product-category/2x2-speedcubes/?r=cubingcontests&utm_source=cubingcontests&utm_campaign=2x21125"
          target="_blank"
          rel="noopener"
          onClick={() => logAffiliateLinkClick("2x21125")}
          className={className}
          style={style}
        >
          <img src={`${bannersUrlPath}/2x2.jpg`} height={height} width={width} alt="Cuboss ad for 2x2x2 puzzles" />
        </a>
      );
    case "wca":
      return (
        <a
          href="https://cuboss.com/product-category/wca-puzzles/?r=cubingcontests&utm_source=cubingcontests&utm_campaign=WCA1125"
          target="_blank"
          rel="noopener"
          onClick={() => logAffiliateLinkClick("WCA1125")}
          className={className}
          style={style}
        >
          <img src={`${bannersUrlPath}/wca.jpg`} height={height} width={width} alt="Cuboss ad for WCA puzzles" />
        </a>
      );
    case "fto":
      return (
        <a
          href="https://cuboss.com/?s=fto&post_type=product&r=cubingcontests&utm_source=cubingcontests&utm_campaign=FTO1125"
          target="_blank"
          rel="noopener"
          onClick={() => logAffiliateLinkClick("FTO1125")}
          className={className}
          style={style}
        >
          <img src={`${bannersUrlPath}/fto.jpg`} height={height} width={width} alt="Cuboss ad for FTO puzzles" />
        </a>
      );
    case "mirror":
      return (
        <a
          href="https://cuboss.com/?s=mirror&post_type=product&r=cubingcontests&utm_source=cubingcontests&utm_campaign=MR1125"
          target="_blank"
          rel="noopener"
          onClick={() => logAffiliateLinkClick("MR1125")}
          className={className}
          style={style}
        >
          <img
            src={`${bannersUrlPath}/mirror.jpg`}
            height={height}
            width={width}
            alt="Cuboss ad for Mirror Blocks puzzles"
          />
        </a>
      );
    case "kilominx":
      return (
        <a
          href="https://cuboss.com/?s=kilominx&post_type=product&r=cubingcontests&utm_source=cubingcontests&utm_campaign=KILO1125"
          target="_blank"
          rel="noopener"
          onClick={() => logAffiliateLinkClick("KILO1125")}
          className={className}
          style={style}
        >
          <img
            src={`${bannersUrlPath}/kilominx.jpg`}
            height={height}
            width={width}
            alt="Cuboss ad for Kilominx puzzles"
          />
        </a>
      );
    case "other":
      return (
        <a
          href="https://cuboss.com/?r=cubingcontests&utm_source=cubingcontests&utm_campaign=SC1125"
          target="_blank"
          rel="noopener"
          onClick={() => logAffiliateLinkClick("SC1125")}
          className={className}
          style={style}
        >
          <img src={`${bannersUrlPath}/other.jpg`} height={height} width={width} alt="Cuboss ad" />
        </a>
      );
    default:
      return;
  }
}

export default AffiliateLink;
