import MindMapClient from "./MindMapClient";
import { use } from "react";

export default function MindMapPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <MindMapClient projectId={id} />;
}
