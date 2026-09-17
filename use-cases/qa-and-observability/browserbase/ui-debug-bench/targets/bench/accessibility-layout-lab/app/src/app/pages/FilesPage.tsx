import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Download, Pencil, Share2, Info, X, Trash2 } from "lucide-react";

interface FileItem {
  id: string;
  name: string;
  type: string;
  size: string;
  updated: string;
  owner: string;
}

const demoFiles: FileItem[] = [
  { id: "1", name: "Q3_Report.pdf", type: "PDF", size: "2.4 MB", updated: "Jun 4, 2026", owner: "Alex Morgan" },
  { id: "2", name: "Design_System.fig", type: "Figma", size: "14 MB", updated: "Jun 3, 2026", owner: "Priya Shah" },
  { id: "3", name: "main.tsx", type: "Code", size: "4.2 KB", updated: "Jun 2, 2026", owner: "Jordan Lee" },
  { id: "4", name: "onboarding-flow.mp4", type: "Video", size: "128 MB", updated: "May 28, 2026", owner: "Sam Rivera" },
  { id: "5", name: "logo-assets.zip", type: "Archive", size: "56 MB", updated: "May 20, 2026", owner: "Casey Kim" },
  { id: "6", name: "investor-update.docx", type: "Doc", size: "812 KB", updated: "May 18, 2026", owner: "Alex Morgan" },
  { id: "7", name: "roadmap-2026.xlsx", type: "Sheet", size: "1.1 MB", updated: "May 12, 2026", owner: "Priya Shah" },
];

export function FilesPage() {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [detailsFile, setDetailsFile] = useState<FileItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [files, setFiles] = useState<FileItem[]>(demoFiles);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    }
    if (openMenuId) document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [openMenuId]);

  function openDetails(file: FileItem) {
    setOpenMenuId(null);
    setDetailsFile(file);
  }

  function closeDetails() {
    setDetailsFile(null);
  }

  function openConfirm() {
    setDialogOpen(true);
    // BUG (intentional): focus stays on the details-delete button behind the dialog.
  }

  function confirmDelete() {
    if (detailsFile) setFiles((prev) => prev.filter((f) => f.id !== detailsFile.id));
    setDialogOpen(false);
    setDetailsFile(null);
  }

  function cancelDelete() {
    setDialogOpen(false);
  }

  return (
    <div className="px-8 py-10 max-w-6xl mx-auto" data-btc-route="a11y-dialog-focus">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Files</h1>
          <p className="mt-1 text-sm text-[oklch(0.5_0.02_260)]">
            Manage your workspace documents and assets.
          </p>
        </div>
        <span
          className="rounded-full bg-[oklch(0.92_0.03_145)] px-3 py-1 text-xs font-medium text-[oklch(0.35_0.08_145)]"
          data-btc-probe="file-count"
        >
          {files.length} items
        </span>
      </div>

      <div
        className="overflow-visible rounded-2xl border border-[oklch(0.88_0.01_85)] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
        data-btc-probe="files-table"
      >
        <div className="grid grid-cols-[1fr_120px_100px_100px_160px_60px] gap-4 border-b border-[oklch(0.9_0.01_85)] px-5 py-3 text-xs font-medium uppercase tracking-wider text-[oklch(0.5_0.02_260)]">
          <span>Name</span>
          <span>Owner</span>
          <span className="text-right">Type</span>
          <span className="text-right">Size</span>
          <span className="text-right">Modified</span>
          <span className="text-right">Actions</span>
        </div>
        <ul className="divide-y divide-[oklch(0.94_0.01_85)]">
          {files.map((file) => (
            <li
              key={file.id}
              className="relative grid grid-cols-[1fr_120px_100px_100px_160px_60px] items-center gap-4 px-5 py-4 hover:bg-[oklch(0.97_0.01_85)]"
              data-btc-probe="file-row"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[oklch(0.94_0.02_260)] text-xs font-semibold text-[oklch(0.4_0.08_260)]">
                  {file.type.slice(0, 2).toUpperCase()}
                </div>
                <span className="text-sm font-medium truncate">{file.name}</span>
              </div>
              <span className="text-sm text-[oklch(0.4_0.02_260)] truncate">{file.owner}</span>
              <span className="text-right text-sm text-[oklch(0.5_0.02_260)]">{file.type}</span>
              <span className="text-right text-sm text-[oklch(0.5_0.02_260)]">{file.size}</span>
              <span className="text-right text-sm text-[oklch(0.5_0.02_260)]">{file.updated}</span>
              <div className="flex items-center justify-end relative">
                <button
                  className="h-8 w-8 inline-flex items-center justify-center rounded-md text-[oklch(0.4_0.02_260)] hover:bg-[oklch(0.94_0.01_85)]"
                  aria-label={`Actions for ${file.name}`}
                  aria-haspopup="menu"
                  aria-expanded={openMenuId === file.id}
                  data-btc-probe="row-actions-trigger"
                  onClick={() =>
                    setOpenMenuId((prev) => (prev === file.id ? null : file.id))
                  }
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
                {openMenuId === file.id && (
                  <div
                    ref={menuRef}
                    role="menu"
                    data-btc-probe="row-actions-menu"
                    className="absolute right-0 top-9 z-20 w-44 rounded-lg border border-[oklch(0.9_0.01_85)] bg-white shadow-lg py-1"
                  >
                    <button
                      role="menuitem"
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-[oklch(0.97_0.01_85)]"
                      onClick={() => setOpenMenuId(null)}
                    >
                      <Download className="h-3.5 w-3.5" /> Download
                    </button>
                    <button
                      role="menuitem"
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-[oklch(0.97_0.01_85)]"
                      onClick={() => setOpenMenuId(null)}
                    >
                      <Pencil className="h-3.5 w-3.5" /> Rename
                    </button>
                    <button
                      role="menuitem"
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-[oklch(0.97_0.01_85)]"
                      onClick={() => setOpenMenuId(null)}
                    >
                      <Share2 className="h-3.5 w-3.5" /> Share
                    </button>
                    <div className="my-1 h-px bg-[oklch(0.94_0.01_85)]" />
                    <button
                      role="menuitem"
                      data-btc-probe="row-action-details"
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-[oklch(0.97_0.01_85)]"
                      onClick={() => openDetails(file)}
                    >
                      <Info className="h-3.5 w-3.5" /> View details
                    </button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
        {files.length === 0 && (
          <div className="px-5 py-12 text-center text-sm text-[oklch(0.5_0.02_260)]">
            No files remaining. Refresh the page to reset the demo.
          </div>
        )}
      </div>

      {/* Details slide-over */}
      {detailsFile && (
        <>
          <div
            className="fixed inset-0 z-30 bg-black/20"
            onClick={closeDetails}
            role="presentation"
          />
          <aside
            className="fixed right-0 top-0 z-40 h-dvh w-full max-w-md bg-white border-l border-[oklch(0.9_0.01_85)] shadow-2xl flex flex-col"
            data-btc-probe="details-panel"
            aria-label="File details"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-[oklch(0.94_0.01_85)]">
              <h2 className="text-base font-semibold">File details</h2>
              <button
                onClick={closeDetails}
                aria-label="Close details"
                className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-[oklch(0.96_0.01_85)] text-[oklch(0.4_0.02_260)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[oklch(0.94_0.02_260)] text-sm font-semibold text-[oklch(0.4_0.08_260)]">
                  {detailsFile.type.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">{detailsFile.name}</div>
                  <div className="text-xs text-[oklch(0.5_0.02_260)]">{detailsFile.type} file</div>
                </div>
              </div>
              <dl className="mt-6 grid grid-cols-1 gap-3 text-sm">
                {[
                  ["Owner", detailsFile.owner],
                  ["Type", detailsFile.type],
                  ["Size", detailsFile.size],
                  ["Modified", detailsFile.updated],
                ].map(([k, v]) => (
                  <div
                    key={k}
                    className="flex items-center justify-between rounded-lg border border-[oklch(0.94_0.01_85)] px-3 py-2"
                  >
                    <dt className="text-[oklch(0.5_0.02_260)]">{k}</dt>
                    <dd className="font-medium">{v}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-6 rounded-lg bg-[oklch(0.97_0.01_85)] px-3 py-2 text-xs text-[oklch(0.45_0.02_260)]">
                Shared with 3 members of your workspace.
              </div>
            </div>
            <div className="px-6 py-4 border-t border-[oklch(0.94_0.01_85)] flex justify-end gap-2">
              <Button variant="outline" onClick={closeDetails}>
                Close
              </Button>
              <Button
                variant="destructive"
                data-btc-probe="details-delete"
                onClick={openConfirm}
              >
                <Trash2 className="h-4 w-4" /> Delete file
              </Button>
            </div>
          </aside>
        </>
      )}

      {dialogOpen && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
            onClick={cancelDelete}
            role="presentation"
          />
          <div
            className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[oklch(0.88_0.01_85)] bg-white p-6 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-dialog-title"
            data-btc-probe="confirm-dialog"
          >
            <h3 id="delete-dialog-title" className="text-center text-base font-semibold">
              Delete file?
            </h3>
            <p className="mt-2 text-center text-sm text-[oklch(0.5_0.02_260)]">
              "{detailsFile?.name}" will be permanently removed. This action cannot be undone.
            </p>
            <div className="mt-6 flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={cancelDelete}
                data-btc-probe="confirm-dialog-cancel"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={confirmDelete}
                data-btc-probe="confirm-dialog-confirm"
              >
                Delete file
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
