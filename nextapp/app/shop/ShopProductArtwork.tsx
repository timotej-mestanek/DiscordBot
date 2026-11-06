import Image from "next/image";
import type { ShopProduct } from "./ShopProductCard";

export default function ShopProductArtwork({
  product,
}: {
  product: ShopProduct;
}) {
  if (product.imageUrl) {
    return (
      <Image
        src={product.imageUrl}
        alt={`${product.name} ${product.productType === "black_market_key" ? "key" : product.productType === "black_market_crate" ? "crate" : "item"}`}
        fill
        unoptimized
        sizes="(max-width: 640px) 90vw, (max-width: 1024px) 45vw, 360px"
        className="object-contain"
      />
    );
  }

  if (product.productType === "black_market_key") {
    return (
      <svg
        viewBox="0 0 160 160"
        fill="none"
        aria-label="Key"
        role="img"
        className="h-36 w-36 text-amber-300 sm:h-44 sm:w-44"
      >
        <circle cx="55" cy="58" r="32" stroke="currentColor" strokeWidth="13" />
        <path
          d="m78 81 53 53m-18-18 17-17m-35-1 17-17"
          stroke="currentColor"
          strokeWidth="13"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (product.productType === "black_market_crate") {
    return (
      <svg
        viewBox="0 0 180 150"
        fill="none"
        aria-label="Crate"
        role="img"
        className="h-36 w-44 text-amber-300 sm:h-44 sm:w-52"
      >
        <path
          d="M25 51h130v77H25zM17 34h146v19H17zM17 53l24 75m122-75-24 75M41 54l28 73m70-73-28 73"
          stroke="currentColor"
          strokeWidth="10"
          strokeLinejoin="round"
        />
        <path d="M77 77h26v29H77z" fill="currentColor" />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 160 160"
      fill="none"
      aria-label="Shop item"
      role="img"
      className="h-32 w-32 text-violet-300 sm:h-40 sm:w-40"
    >
      <path
        d="M32 58h96v77H32zM23 39h114v20H23zM80 39v96"
        stroke="currentColor"
        strokeWidth="9"
        strokeLinejoin="round"
      />
      <path
        d="M80 39H52a15 15 0 1 1 15-15c0 9 13 15 13 15Zm0 0h28a15 15 0 1 0-15-15c0 9-13 15-13 15Z"
        stroke="currentColor"
        strokeWidth="7"
      />
    </svg>
  );
}
