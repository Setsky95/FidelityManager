import { Users, Coins, UserPlus, Star } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { MemberStats } from "@shared/schema";

interface StatsCardsProps {
  stats: MemberStats;
  isLoading?: boolean;
}

export function StatsCards({ stats, isLoading }: StatsCardsProps) {
  const cards = [
    {
      title: "Total Socios",
      value: stats.totalMembers,
      icon: Users,
      bgColor: "bg-primary bg-opacity-10",
      iconColor: "text-primary",
    },
    {
      title: "Puntos Totales",
      value: stats.totalPoints.toLocaleString(),
      icon: Coins,
      bgColor: "bg-success bg-opacity-10",
      iconColor: "text-success",
    },
    {
      title: "Nuevos Este Mes",
      value: stats.newThisMonth,
      icon: UserPlus,
      bgColor: "bg-warning bg-opacity-10",
      iconColor: "text-warning",
    },
    {
      title: "Promedio Puntos",
      value: stats.averagePoints,
      icon: Star,
      bgColor: "bg-purple-500 bg-opacity-10",
      iconColor: "text-purple-500",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {cards.map((card) => (
        <Card key={card.title} className="border border-gray-200" data-testid={`stat-card-${card.title.toLowerCase().replace(/\s+/g, '-')}`}>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className={`w-8 h-8 ${card.bgColor} rounded-lg flex items-center justify-center`}>
                  <card.icon className={`h-5 w-5 ${card.iconColor}`} />
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">{card.title}</p>
                <p className="text-2xl font-semibold text-gray-900" data-testid={`stat-value-${card.title.toLowerCase().replace(/\s+/g, '-')}`}>
                  {isLoading ? "..." : card.value}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
