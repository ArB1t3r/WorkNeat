import React from "react";
import ReactDOM from "react-dom/client";
import { Toast } from "@heroui/react";
import App from "./App";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
    <Toast.Provider placement="bottom end" />
  </React.StrictMode>,
);
