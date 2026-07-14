import NavBar from "@/components/NavBar";
import PlayEditor from "@/components/PlayEditor";

export const metadata = { title: "New Play" };

export default function NewPlayPage() {
  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <NavBar />
      <div className="flex-1 min-h-0">
        <PlayEditor />
      </div>
    </div>
  );
}
