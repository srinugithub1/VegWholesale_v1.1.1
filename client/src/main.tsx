import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { ShopProvider } from "@/hooks/use-shop";

createRoot(document.getElementById("root")!).render(
    <ShopProvider>
        <App />
    </ShopProvider>
);
