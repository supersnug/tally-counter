import { useEffect, useState } from "react";
import { RotateCcw, Trash2, X } from "lucide-react";
import { CounterCard } from "../counters/CounterCard";
import { TRASH_LIFETIME } from "../counters/model";

const formatTrashTime = (milliseconds) => {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000)),
    minutes = Math.floor(seconds / 60),
    hours = Math.floor(minutes / 60),
    days = Math.floor(hours / 24);
  if (days) return `${days}d ${hours % 24}h`;
  if (hours) return `${hours}h ${minutes % 60}m`;
  if (minutes) return `${minutes}m`;
  return `${seconds}s`;
};

export function TrashModal({
  items,
  showBounds,
  showLocalBanner,
  onChange,
  onEdit,
  onEmbed,
  onRestore,
  onDelete,
  onClose,
}) {
  const [now, setNow] = useState(Date.now());
  const [pendingDelete, setPendingDelete] = useState(null);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <>
      <div
        className="modal-backdrop"
        onMouseDown={(event) =>
          event.target === event.currentTarget && onClose()
        }
      >
        <div className="modal trash-modal">
          <div className="modal-head">
            <div>
              <span>TRASH</span>
              <h2>Recently deleted</h2>
            </div>
            <button onClick={onClose}>
              <X />
            </button>
          </div>
          <p className="trash-intro">
            Counters here still work normally and are permanently deleted five
            days after they enter Trash.
          </p>
          {items.length ? (
            <div className="trash-list">
              {items.map((counter, index) => (
                <div className="trash-item" key={counter.id}>
                  <div className="trash-toolbar">
                    <span>
                      <Trash2 /> Deletes in{" "}
                      <b>
                        {formatTrashTime(
                          TRASH_LIFETIME - (now - Number(counter.deletedAt)),
                        )}
                      </b>
                    </span>
                    <button onClick={() => onRestore(counter)}>
                      <RotateCcw /> Restore
                    </button>
                  </div>
                  <CounterCard
                    counter={counter}
                    index={index}
                    showBounds={showBounds}
                    showLocalBanner={showLocalBanner}
                    onChange={onChange}
                    onEdit={() => onEdit(counter)}
                    onEmbed={() => onEmbed(counter)}
                    onDelete={() => setPendingDelete(counter)}
                    onReset={() =>
                      onChange(counter.id, counter.start - counter.value)
                    }
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="trash-empty">
              <Trash2 />
              <b>Trash is empty</b>
              <span>Deleted counters will appear here for five days.</span>
            </div>
          )}
        </div>
      </div>
      {pendingDelete && (
        <div
          className="modal-backdrop trash-confirm-backdrop"
          onMouseDown={(event) =>
            event.target === event.currentTarget && setPendingDelete(null)
          }
        >
          <div
            className="modal trash-confirm-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="trash-confirm-title"
          >
            <div className="modal-head">
              <div>
                <span>PERMANENT DELETE</span>
                <h2 id="trash-confirm-title">
                  Delete “{pendingDelete.name}” forever?
                </h2>
              </div>
              <button onClick={() => setPendingDelete(null)}>
                <X />
              </button>
            </div>
            <p>
              This counter cannot be restored after it is permanently deleted.
            </p>
            <div className="modal-footer">
              <button className="cancel" onClick={() => setPendingDelete(null)}>
                Cancel
              </button>
              <button
                className="save trash-confirm-delete"
                onClick={() => {
                  onDelete(pendingDelete);
                  setPendingDelete(null);
                }}
              >
                <Trash2 /> Delete forever
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
