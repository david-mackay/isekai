"use client";
import { useState } from "react";

export interface StoryListItem {
  id: string;
  title: string;
  beginningLabel: string;
  createdAt: string;
  lastPlayedAt: string;
  messageCount: number;
}

interface StorySidebarProps {
  stories: StoryListItem[];
  loading?: boolean;
  currentStoryId?: string;
  onStorySelect: (storyId: string) => Promise<void> | void;
  onDeleteStory: (storyId: string) => void;
  onClearAll?: () => void;
  isOverlay?: boolean;
  visible?: boolean;
  onClose?: () => void;
}

export default function StorySidebar({
  stories,
  loading = false,
  currentStoryId,
  onStorySelect,
  onDeleteStory,
  onClearAll,
  isOverlay,
  visible,
  onClose,
}: StorySidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  // Mobile overlay variant
  if (isOverlay) {
    if (!visible) return null;
    return (
      <div className="fixed inset-0 z-50">
        <div className="absolute inset-0 bg-black/60" onClick={onClose}></div>
        <div className="relative h-full w-[85%] max-w-xs bg-gray-900 border-r border-gray-700">
          <div className="p-4 border-b border-gray-700 flex items-center justify-between">
            <h2 className="font-semibold text-lg">Stories</h2>
            <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded">
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="p-4 text-center text-gray-400">
                  <p>Loading stories…</p>
                </div>
              ) : stories.length === 0 ? (
              <div className="p-4 text-center text-gray-400">
                <p className="mb-2">No stories yet</p>
                <p className="text-xs text-gray-500">
                  Start a new adventure from the main panel.
                </p>
              </div>
            ) : (
              <div className="p-2">
                {stories.map((story) => (
                  <div
                    key={story.id}
                    className={`p-3 mb-2 rounded cursor-pointer transition-colors group ${
                      currentStoryId === story.id
                        ? "bg-blue-900/30 border border-blue-500/30"
                        : "hover:bg-gray-800/50"
                    }`}
                      onClick={() => {
                        void onStorySelect(story.id);
                        onClose?.();
                      }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium truncate text-sm">
                          {story.title}
                        </h3>
                        <p className="text-xs text-gray-400 mt-1">
                          {story.beginningLabel}
                        </p>
                      <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                        <span>{formatDate(story.lastPlayedAt)}</span>
                          <span>•</span>
                          <span>{story.messageCount} messages</span>
                        </div>
                      </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteStory(story.id);
                          }}
                        className="opacity-100 p-1 hover:text-red-400"
                        title="Delete story"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (isCollapsed) {
    return (
      <div className="w-12 bg-gray-900/50 border-r border-gray-700 flex flex-col">
        <button
          onClick={() => setIsCollapsed(false)}
          className="p-3 hover:bg-gray-800 border-b border-gray-700"
          title="Expand sidebar"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className="w-80 bg-gray-900/50 border-r border-gray-700 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-700 flex items-center justify-between">
        <h2 className="font-semibold text-lg">Stories</h2>
          <div className="flex gap-1">
            {onClearAll && (
              <button
                onClick={() => {
                  if (
                    confirm(
                      "Clear all stories? This will delete all saved adventures."
                    )
                  ) {
                    onClearAll();
                  }
                }}
                className="p-2 hover:bg-gray-800 rounded text-red-400"
                title="Clear all stories"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          <button
            onClick={() => setIsCollapsed(true)}
            className="p-2 hover:bg-gray-800 rounded"
            title="Collapse sidebar"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Stories list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-center text-gray-400">
            <p>Loading stories…</p>
          </div>
        ) : stories.length === 0 ? (
          <div className="p-4 text-center text-gray-400">
            <p className="mb-2">No stories yet</p>
            <p className="text-xs text-gray-500">
              Use the main panel to start a new adventure.
            </p>
          </div>
        ) : (
          <div className="p-2">
            {stories.map((story) => (
              <div
                key={story.id}
                className={`p-3 mb-2 rounded cursor-pointer transition-colors group ${
                  currentStoryId === story.id
                    ? "bg-blue-900/30 border border-blue-500/30"
                    : "hover:bg-gray-800/50"
                }`}
                onClick={() => void onStorySelect(story.id)}
              >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium truncate text-sm">
                          {story.title}
                        </h3>
                        <p className="text-xs text-gray-400 mt-1">
                          {story.beginningLabel}
                        </p>
                        <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                          <span>{formatDate(story.lastPlayedAt)}</span>
                          <span>•</span>
                          <span>{story.messageCount} messages</span>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteStory(story.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition-opacity"
                        title="Delete story"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
