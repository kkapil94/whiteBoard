import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaPlus, FaTrash, FaEdit, FaUsers } from "react-icons/fa";
import { toast } from "sonner";

// UI components
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

// Redux hooks
import {
  useGetBoardsQuery,
  useCreateBoardMutation,
  useDeleteBoardMutation,
} from "@/store/api/boardApi";

const Dashboard: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [showNewBoardInput, setShowNewBoardInput] = useState(false);
  const [newBoardName, setNewBoardName] = useState("");
  const navigate = useNavigate();

  // RTK Query hooks
  const { data: boards = [], isLoading } = useGetBoardsQuery();
  const [createBoard] = useCreateBoardMutation();
  const [deleteBoard] = useDeleteBoardMutation();

  // Filter boards based on search
  const filteredBoards = boards.filter((board) =>
    board.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Create a new board
  const handleCreateBoard = async () => {
    if (!newBoardName.trim()) {
      toast.error("Board name cannot be empty");
      return;
    }

    try {
      await createBoard({ name: newBoardName.trim() }).unwrap();
      setNewBoardName("");
      setShowNewBoardInput(false);
      toast.success("Whiteboard created successfully");
    } catch (error) {
      console.error("Error creating board:", error);
      toast.error("Failed to create whiteboard");
    }
  };

  // Delete a board
  const handleDeleteBoard = async (boardId: string) => {
    if (!confirm("Are you sure you want to delete this whiteboard?")) {
      return;
    }

    try {
      await deleteBoard(boardId).unwrap();
      toast.success("Whiteboard deleted successfully");
    } catch (error) {
      console.error("Error deleting board:", error);
      toast.error("Failed to delete whiteboard");
    }
  };

  // Open board in the whiteboard editor
  const handleOpenBoard = (boardId: string) => {
    navigate(`/board/${boardId}`);
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">My Whiteboards</h1>
        <Button
          onClick={() => setShowNewBoardInput((prev) => !prev)}
          className="flex items-center gap-2"
        >
          <FaPlus />
          <span>New Whiteboard</span>
        </Button>
      </div>

      {showNewBoardInput && (
        <div className="mb-8 bg-card p-4 rounded-lg border shadow-sm">
          <h2 className="text-xl font-semibold mb-4">Create New Whiteboard</h2>
          <div className="flex gap-2">
            <Input
              placeholder="Enter whiteboard name..."
              value={newBoardName}
              onChange={(e) => setNewBoardName(e.target.value)}
              className="flex-1"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateBoard();
              }}
            />
            <Button onClick={handleCreateBoard}>Create</Button>
            <Button
              variant="outline"
              onClick={() => setShowNewBoardInput(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      <div className="mb-6">
        <Input
          placeholder="Search whiteboards..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-md"
        />
      </div>

      <Separator className="my-6" />

      {isLoading ? (
        <div className="flex justify-center items-center min-h-[200px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : filteredBoards.length === 0 ? (
        <div className="text-center py-12 bg-muted/50 rounded-lg">
          <h2 className="text-xl font-semibold mb-2">No whiteboards found</h2>
          {searchTerm ? (
            <p>No results match your search. Try different keywords.</p>
          ) : (
            <p>Create your first whiteboard to get started!</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredBoards.map((board) => (
            <Card
              key={board.id}
              className="overflow-hidden hover:shadow-md transition-shadow"
            >
              <div
                className="h-40 bg-muted cursor-pointer flex items-center justify-center hover:bg-muted/80 transition-colors"
                onClick={() => handleOpenBoard(board.id)}
              >
                <div className="text-xl font-medium">{board.name}</div>
              </div>
              <div className="p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-medium truncate" title={board.name}>
                      {board.name}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Created on {formatDate(board.createdAt)}
                    </p>
                    <div className="flex items-center gap-1 mt-1 text-sm text-muted-foreground">
                      <FaUsers size={14} />
                      <span>
                        {board._count?.members || board.members.length} members
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleOpenBoard(board.id)}
                      title="Edit whiteboard"
                    >
                      <FaEdit />
                    </Button>
                    {board.owner.id ===
                      JSON.parse(localStorage.getItem("user") || "{}")?.id && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteBoard(board.id);
                        }}
                        title="Delete whiteboard"
                      >
                        <FaTrash />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Dashboard;
