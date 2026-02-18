import { useState, useEffect } from "react";
import { Clock, Calendar } from "lucide-react";

export function DateTimeDisplay() {
  const [dateTime, setDateTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setDateTime(new Date());
    }, 1000); // Update every second for better precision, though minutes display is fine too

    return () => clearInterval(timer);
  }, []);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  };

  return (
    <div className="flex items-center gap-4 px-3 py-1 bg-muted/30 rounded-full border text-sm font-medium text-muted-foreground mr-2">
      <div className="flex items-center gap-1.5 border-r pr-3">
        <Calendar className="h-3.5 w-3.5 text-primary/70" />
        <span className="tabular-nums">{formatDate(dateTime)}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <Clock className="h-3.5 w-3.5 text-primary/70" />
        <span className="tabular-nums uppercase">{formatTime(dateTime)}</span>
      </div>
    </div>
  );
}
