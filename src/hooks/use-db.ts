import { useEffect, useState } from "react";
import { getDbState, syncWithCatalyst } from "../lib/db";

export function useDb() {
  const [state, setState] = useState(() => getDbState());

  useEffect(() => {
    const handleUpdate = () => {
      setState(getDbState());
    };
    window.addEventListener("db-update", handleUpdate);
    
    // Background sync with Zoho Catalyst cloud Data Store
    syncWithCatalyst();

    return () => window.removeEventListener("db-update", handleUpdate);
  }, []);

  return state;
}

