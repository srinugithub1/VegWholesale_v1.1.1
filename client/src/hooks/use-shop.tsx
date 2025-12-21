import { createContext, useContext, useState, ReactNode } from "react";

type Shop = 45 | 50;

interface ShopContextType {
    shop: Shop;
    setShop: (shop: Shop) => void;
}

const ShopContext = createContext<ShopContextType | undefined>(undefined);

export function ShopProvider({ children }: { children: ReactNode }) {
    const [shop, setShop] = useState<Shop>(45);

    return (
        <ShopContext.Provider value={{ shop, setShop }}>
            {children}
        </ShopContext.Provider>
    );
}

export function useShop() {
    const context = useContext(ShopContext);
    if (context === undefined) {
        throw new Error("useShop must be used within a ShopProvider");
    }
    return context;
}
