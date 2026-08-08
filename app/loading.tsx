import LoadingScreen from "@/components/LoadingScreen";

export default function Loading() {
  return (
    <LoadingScreen
      label="Montando el escenario…"
      lines={[
        "Preparando tu catálogo…",
        "Afinando la señal…",
        "Casi listo para el show…",
      ]}
    />
  );
}
