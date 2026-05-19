"use client";

import { Fragment } from "react";

const URL_REGEX = /(https?:\/\/[^\s]+)/g;

type LinkifiedTextProps = {
  text: string;
  className?: string;
};

export function LinkifiedText({ text, className }: LinkifiedTextProps): React.JSX.Element {
  const parts = text.split(URL_REGEX);
  return (
    <p className={className}>
      {parts.map((part, i) =>
        part.startsWith("http://") || part.startsWith("https://") ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 underline break-all hover:text-blue-800"
          >
            {part}
          </a>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </p>
  );
}
