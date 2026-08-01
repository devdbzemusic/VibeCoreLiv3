import { SampleLibrary } from "./library/SampleLibrary";
import { GroovePresetLibrary } from "./library/GroovePresetLibrary";
import { ProjectActions } from "./ProjectActions";

export function LibTab() {
  return (
    <div className="p-3 space-y-3">
      <ProjectActions />
      <SampleLibrary />
      <GroovePresetLibrary />
    </div>
  );
}