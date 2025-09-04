import { useState } from "react";
import { Bell, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatsCards } from "@/components/stats-cards";
import { MembersTable } from "@/components/members-table";
import { AddMemberModal } from "@/components/add-member-modal";
import { EditPointsModal } from "@/components/edit-points-modal";
import { useMembers } from "@/hooks/use-members";
import { QuickAddPoints } from "@/components/quick-add-points";
import { BurgerMenu } from "@/components/burgerMenu.jsx";
import { useStats } from "@/hooks/use-stats";
import type { Member, InsertMember, UpdatePoints } from "@shared/schema";
import MobileNavBar from "@/components/MobileNavbar";

export default function Dashboard() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const PageName = "Dashboard";
  const {
    members,
    isLoading: membersLoading,
    addMember,
    updatePoints,
    deleteMember,
  } = useMembers();

  const { stats, isLoading: statsLoading } = useStats();

  const handleAddMember = async (member: InsertMember) => {
    await addMember.mutateAsync(member);
  };

  const handleEditPoints = (member: Member) => {
    setSelectedMember(member);
    setIsEditModalOpen(true);
  };

  const handleUpdatePoints = async (
    memberId: string,
    currentPoints: number,
    update: UpdatePoints
  ) => {
    await updatePoints.mutateAsync({ memberId, currentPoints, update });
  };

  const handleViewMember = (member: Member) => {
    // TODO: Implement view member details
    console.log("View member:", member);
  };

  const handleDeleteMember = async (memberId: string) => {
    if (window.confirm("¿Está seguro de que desea eliminar este socio?")) {
      await deleteMember.mutateAsync(memberId);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <MobileNavBar pageName={PageName} />
      {/* Dashboard Content */}
      <main className="flex-1 overflow-y-auto bg-surface">
        <div className="p-6">
          {/* Stats Cards */}
          <StatsCards stats={stats} isLoading={statsLoading} />

          <QuickAddPoints
            members={members}
            onAddPoints={(memberId, amount) =>
              updatePoints.mutateAsync({
                memberId,
                amount,
                reason: "Carga rápida",
              })
            }
          />
          {/* Members Management Section */}
          <MembersTable
            members={members}
            isLoading={membersLoading}
            onEditPoints={handleEditPoints}
            onViewMember={handleViewMember}
            onDeleteMember={handleDeleteMember}
          />
        </div>
      </main>

      {/* Modals */}
      <AddMemberModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAddMember={handleAddMember}
        isLoading={addMember.isPending}
      />

      <EditPointsModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        member={selectedMember}
        onUpdatePoints={handleUpdatePoints}
        isLoading={updatePoints.isPending}
      />
    </div>
  );
}
