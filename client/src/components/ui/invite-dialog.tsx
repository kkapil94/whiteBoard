import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./dialog";
import { Button } from "./button";
import { Input } from "./input";
import { useState } from "react";
import { toast } from "sonner";
import { useAddBoardMemberMutation } from "../../store/api/boardApi";

interface InviteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  boardId: string;
}

export function InviteDialog({ isOpen, onClose, boardId }: InviteDialogProps) {
  const [email, setEmail] = useState("");
  const [addBoardMember, { isLoading }] = useAddBoardMemberMutation();

  const handleInvite = async () => {
    if (!email) {
      toast.error("Please enter an email address");
      return;
    }

    try {
      await addBoardMember({ boardId, email }).unwrap();
      toast.success("Invitation sent successfully");
      onClose();
      setEmail("");
    } catch (error) {
      console.error("Error sending invitation:", error);
      toast.error("Failed to send invitation");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite Collaborator</DialogTitle>
        </DialogHeader>
        <div className="p-4">
          <Input
            type="email"
            placeholder="Enter email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleInvite} disabled={isLoading}>
            {isLoading ? "Sending..." : "Send Invitation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
