import React from "react";

const Tag = ({ tone = "default", children }) => {
  return <span className={`tag tag-${tone}`}>{children}</span>;
};

export default Tag;
