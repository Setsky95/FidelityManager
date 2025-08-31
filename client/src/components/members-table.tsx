import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Edit,
  Eye,
  Trash2,
  ArrowUpDown,
  UserPlus,
  Coins,
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

  const handleSort = (field: keyof Member) => {
    if (sortBy === field) setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    else {
      setSortBy(field);
      setSortOrder("asc");
    }
  };

  const getInitials = (nombre: string, apellido: string) =>
    `${nombre?.charAt(0) ?? ""}${apellido?.charAt(0) ?? ""}`.toUpperCase();

  const safeDate = (d: unknown) => (d instanceof Date ? d : new Date(String(d)));

  const formatDate = (date: Date | string) =>
    new Intl.DateTimeFormat("es-ES", { month: "short", year: "numeric" }).format(
      safeDate(date)
    );

  // Usamos Tailwind nativo para colores; ajustá a tu design system si tenés tokens
  const getPointsBadgeColor = (points: number) => {
    if (points >= 200) return "bg-green-100 text-green-700";
    if (points >= 100) return "bg-blue-100 text-blue-700";
    if (points >= 50) return "bg-amber-100 text-amber-700";
    return "bg-gray-100 text-gray-700";
  };

  // Filter + Sort + Pagination con memo para performance
  const filteredMembers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) =>
      [m.nombre, m.apellido, m.email].some((v) =>
        String(v).toLowerCase().includes(q)
      )
    );
  }, [members, searchQuery]);

  const sortedMembers = useMemo(() => {
    const copy = [...filteredMembers];
    copy.sort((a, b) => {
      let aValue: any = a[sortBy] as any;
      let bValue: any = b[sortBy] as any;

      if (sortBy === "fechaRegistro") {
        aValue = safeDate(aValue).getTime();
        bValue = safeDate(bValue).getTime();
      }
      if (typeof aValue === "string") {
        aValue = aValue.toLowerCase();
        bValue = String(bValue).toLowerCase();
      }
      const cmp = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      return sortOrder === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [filteredMembers, sortBy, sortOrder]);

  const totalPages = Math.ceil(sortedMembers.length / itemsPerPage) || 1;
  const currentPageSafe = Math.min(Math.max(currentPage, 1), totalPages);
  const startIndex = (currentPageSafe - 1) * itemsPerPage;

  const paginatedMembers = useMemo(
    () => sortedMembers.slice(startIndex, startIndex + itemsPerPage),
    [sortedMembers, startIndex]
  );

  // Si cambia el filtro o el sort, reseteamos a página 1
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useMemo(() => setCurrentPage(1), [searchQuery, sortBy, sortOrder]);

  return (
    <Card className="border border-gray-200">
      {/* Header / acciones */}
      <div className="px-4 py-4 sm:px-6 border-b border-gray-200">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Gestión de Socios</h3>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <div className="relative">
              <Input
                type="text"
                placeholder="Buscar socios..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-full sm:w-72"
                data-testid="input-search-members"
                aria-label="Buscar socios"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4 pointer-events-none" />
            </div>

            {/* Botón que abre modal de alta */}
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

      <CardContent className="p-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner className="h-8 w-8" />
          </div>
        ) : (
          <>
            {/* Vista mobile: lista tipo tarjetas */}
            <div className="sm:hidden">
              {paginatedMembers.length > 0 ? (
                <ul className="divide-y divide-gray-200">
                  {paginatedMembers.map((m) => (
                    <li key={m.id} className="p-4" data-testid={`member-card-${m.id}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className="h-10 w-10 shrink-0 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="text-sm font-medium text-primary">
                              {getInitials(m.nombre, m.apellido)}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {m.nombre} {m.apellido}
                            </p>
                            <p className="text-xs text-gray-500">Miembro desde {formatDate(m.fechaRegistro)}</p>
                            <p className="text-xs text-gray-600 truncate" title={m.email}>
                              {m.email}
                            </p>
                          </div>
                        </div>
                        <Badge className={getPointsBadgeColor(m.puntos)}>
                          <Coins className="mr-1 h-3 w-3" />
                          {m.puntos}
                        </Badge>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onEditPoints(m)}
                          aria-label={`Editar puntos de ${m.nombre} ${m.apellido}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onViewMember(m)}
                          aria-label={`Ver ${m.nombre} ${m.apellido}`}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onDeleteMember(m.id)}
                          aria-label={`Eliminar ${m.nombre} ${m.apellido}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="px-4 py-12 text-center text-gray-500">
                  {searchQuery
                    ? "No se encontraron socios que coincidan con la búsqueda"
                    : "No hay socios registrados"}
                </div>
              )}
            </div>

            {/* Vista tabla (sm y superior) */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 sm:px-6 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <button
                        onClick={() => handleSort("nombre")}
                        className="flex items-center gap-1 hover:text-gray-700"
                        data-testid="sort-button-name"
                      >
                        <span>Socio</span>
                        <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </th>
                    <th className="px-4 py-3 sm:px-6 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                      <button
                        onClick={() => handleSort("email")}
                        className="flex items-center gap-1 hover:text-gray-700"
                        data-testid="sort-button-email"
                      >
                        <span>Email</span>
                        <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </th>
                    <th className="px-4 py-3 sm:px-6 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <button
                        onClick={() => handleSort("puntos")}
                        className="flex items-center gap-1 hover:text-gray-700"
                        data-testid="sort-button-points"
                      >
                        <span>Puntos</span>
                        <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </th>
                    <th className="px-4 py-3 sm:px-6 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                      ID
                    </th>
                    <th className="px-4 py-3 sm:px-6 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>

                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedMembers.map((member) => (
                    <tr key={member.id} className="hover:bg-gray-50" data-testid={`member-row-${member.id}`}>
                      <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-10 w-10 shrink-0">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                              <span className="text-sm font-medium text-primary">
                                {getInitials(member.nombre, member.apellido)}
                              </span>
                            </div>
                          </div>
                          <div className="ml-4 min-w-0">
                            <div
                              className="text-sm font-medium text-gray-900 truncate"
                              data-testid={`member-name-${member.id}`}
                              title={`${member.nombre} ${member.apellido}`}
                            >
                              {member.nombre} {member.apellido}
                            </div>
                            <div className="text-xs text-gray-500">
                              Miembro desde {formatDate(member.fechaRegistro)}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap hidden md:table-cell">
                        <div
                          className="text-sm text-gray-900 truncate max-w-[220px]"
                          data-testid={`member-email-${member.id}`}
                          title={member.email}
                        >
                          {member.email}
                        </div>
                      </td>

                      <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap">
                        <Badge className={getPointsBadgeColor(member.puntos)} data-testid={`member-points-${member.id}`}>
                          <Coins className="mr-1 h-3 w-3" />
                          {member.puntos}
                        </Badge>
                      </td>

                      <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap text-sm text-gray-500 hidden lg:table-cell" data-testid={`member-id-${member.id}`}>
                        {member.id.slice(0, 8)}
                      </td>

                      <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap text-left text-sm font-medium">
                        <div className="flex gap-1 sm:gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onEditPoints(member)}
                            data-testid={`button-edit-points-${member.id}`}
                            aria-label={`Editar puntos de ${member.nombre} ${member.apellido}`}
                            className="h-8 w-8"
                          >
                            <Edit className="h-4 w-4 text-primary" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onViewMember(member)}
                            data-testid={`button-view-member-${member.id}`}
                            aria-label={`Ver ${member.nombre} ${member.apellido}`}
                            className="h-8 w-8"
                          >
                            <Eye className="h-4 w-4 text-gray-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onDeleteMember(member.id)}
                            data-testid={`button-delete-member-${member.id}`}
                            aria-label={`Eliminar ${member.nombre} ${member.apellido}`}
                            className="h-8 w-8"
                          >
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

            {/* Paginación */}
            {sortedMembers.length > 0 && (
              <div className="px-4 py-3 sm:px-6 border-t border-gray-200 bg-gray-50">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm text-gray-700" data-testid="pagination-info">
                    Mostrando <span className="font-medium">{startIndex + 1}</span> a{" "}
                    <span className="font-medium">{Math.min(startIndex + itemsPerPage, sortedMembers.length)}</span>{" "}
                    de <span className="font-medium">{sortedMembers.length}</span> resultados
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPageSafe === 1}
                      data-testid="button-previous-page"
                    >
                      Anterior
                    </Button>
                    <span className="text-sm text-gray-600 min-w-[4ch] text-center" aria-live="polite">
                      {currentPageSafe}/{totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPageSafe === totalPages}
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
