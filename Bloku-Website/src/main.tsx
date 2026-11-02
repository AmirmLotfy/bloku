import { hydrateRoot } from "react-dom/client";
import App from "./App";
import type { PageContext } from "./types";
import "./styles.css";

const root = document.getElementById("root");
const data = document.getElementById("page-data");
if (root && data?.textContent) {
  const context: PageContext = JSON.parse(data.textContent);
  hydrateRoot(root, <App {...context} />);
}
