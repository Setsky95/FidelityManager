import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search, Edit, Eye, Trash2, ArrowUpDown, UserPlus, Coins,
} from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import type { Member } from "@shared/schema";

// ⬇️ importá el modal y el tipo para crear
import { AddMemberModal } from "@/components/add-member-modal";
import type { InsertMember } from "@shared/schema";

interface MembersTableProps {
  members: Member[];
  isLoading?: boolean;
  onEditPoints: (member: Member) => void;
  onViewMember: (member: Member) => void;
  onDeleteMember: (memberId: string) => void;

  // ⬇️ nuevos props para crear desde el modal
  onAddMember: (member: InsertMember) => Promise<void> | void;
  isAdding?: boolean;
}

export function MembersTable({
  members,
  isLoading,
  onEditPoints,
  onViewMember,
  onDeleteMember,
  onAddMember,
  isAdding,
}: MembersTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<keyof Member>("nombre");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Filter
  const filteredMembers = members.filter((m) =>
    [m.nombre, m.apellido, m.email].some((v) =>
      v.toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  // Sort
  const sortedMembers = [...filteredMembers].sort((a, b) => {
    let aValue: any = a[sortBy];
    let bValue: any = b[sortBy];

    if (sortBy === "fechaRegistro") {
      aValue = new Date(aValue as Date).getTime();
      bValue = new Date(bValue as Date).getTime();
    }
    if (typeof aValue === "string") {
      aValue = aValue.toLowerCase();
      bValue = (bValue as string).toLowerCase();
    }
    return sortOrder === "asc"
      ? aValue < bValue ? -1 : aValue > bValue ? 1 : 0
      : aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
  });

  // Pagination
  const totalPages = Math.ceil(sortedMembers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedMembers = sortedMembers.slice(
    startIndex,
    startIndex + itemsPerPage
  );

  const handleSort = (field: keyof Member) => {
    if (sortBy === field) setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    else {
      setSortBy(field);
      setSortOrder("asc");
    }
  };

  const getInitials = (nombre: string, apellido: string) =>
    `${nombre.charAt(0)}${apellido.charAt(0)}`.toUpperCase();

  const formatDate = (date: Date) =>
    new Intl.DateTimeFormat("es-ES", { month: "short", year: "numeric" }).format(
      date
    );

  const getPointsBadgeColor = (points: number) => {
    if (points >= 200) return "bg-success bg-opacity-10 text-white-600";
    if (points >= 100) return "bg-primary bg-opacity-10 text-white-600";
    if (points >= 50) return "bg-warning bg-opacity-10 text-white-600";
    return "bg-gray-100 text-gray-600";
  };

  return (
    <Card className="border border-gray-200">
      {/* Section Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
          <h3 className="text-lg font-semibold text-gray-900">Gestión de Socios</h3>

          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
            {/* Search Bar */}
            <div className="relative">
              <Input
                type="text"
                placeholder="Buscar socios..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-full sm:w-64"
                data-testid="input-search-members"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
            </div>

            {/* ⬇️ Botón que dispara el modal para agregar socio */}
            <AddMemberModal
              onAddMember={onAddMember}
              isLoading={isAdding}
              trigger={
                <Button data-testid="button-open-add-member">
                  <UserPlus className="mr-2 h-4 w-4" />
                  Agregar Socio
                </Button>
              }
            />
          </div>
        </div>
      </div>

      {/* Members Table */}
      <CardContent className="p-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner className="h-8 w-8" />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <button
                        onClick={() => handleSort("nombre")}
                        className="flex items-center space-x-1 hover:text-gray-700"
                        data-testid="sort-button-name"
                      >
                        <span>Socio</span>
                        <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <button
                        onClick={() => handleSort("email")}
                        className="flex items-center space-x-1 hover:text-gray-700"
                        data-testid="sort-button-email"
                      >
                        <span>Email</span>
                        <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <button
                        onClick={() => handleSort("puntos")}
                        className="flex items-center space-x-1 hover:text-gray-700"
                        data-testid="sort-button-points"
                      >
                        <span>Puntos</span>
                        <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>

                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedMembers.map((member) => (
                    <tr key={member.id} className="hover:bg-gray-50" data-testid={`member-row-${member.id}`}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            <div className="h-10 w-10 rounded-full bg-primary bg-opacity-10 flex items-center justify-center">
                              <span className="text-sm font-medium text-primary">
                                {getInitials(member.nombre, member.apellido)}
                              </span>
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900" data-testid={`member-name-${member.id}`}>
                              {member.nombre} {member.apellido}
                            </div>
                            <div className="text-sm text-gray-500">
                              Miembro desde {formatDate(member.fechaRegistro)}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900" data-testid={`member-email-${member.id}`}>
                          {member.email}
                        </div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge className={getPointsBadgeColor(member.puntos)} data-testid={`member-points-${member.id}`}>
                          <Coins className="mr-1 h-3 w-3" />
                          {member.puntos}
                        </Badge>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500" data-testid={`member-id-${member.id}`}>
                        {member.id.slice(0, 8)}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex space-x-2">
                          <Button variant="ghost" size="sm" onClick={() => onEditPoints(member)} data-testid={`button-edit-points-${member.id}`}>
                            <Edit className="h-4 w-4 text-primary" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => onViewMember(member)} data-testid={`button-view-member-${member.id}`}>
                            <Eye className="h-4 w-4 text-gray-600" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => onDeleteMember(member.id)} data-testid={`button-delete-member-${member.id}`}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {paginatedMembers.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                        {searchQuery
                          ? "No se encontraron socios que coincidan con la búsqueda"
                          : "No hay socios registrados"}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-3 border-t border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-700" data-testid="pagination-info">
                    Mostrando <span className="font-medium">{startIndex + 1}</span> a{" "}
                    <span className="font-medium">
                      {Math.min(startIndex + itemsPerPage, sortedMembers.length)}
                    </span>{" "}
                    de <span className="font-medium">{sortedMembers.length}</span> resultados
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      data-testid="button-previous-page"
                    >
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      data-testid="button-next-page"
                    >
                      Siguiente
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
