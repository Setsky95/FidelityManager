import { type Member, type InsertMember } from "@shared/schema";
import { randomUUID } from "crypto";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  getMember(id: string): Promise<Member | undefined>;
  getMemberByEmail(email: string): Promise<Member | undefined>;
  createMember(member: InsertMember): Promise<Member>;
}

export class MemStorage implements IStorage {
  private members: Map<string, Member>;

  constructor() {
    this.members = new Map();
  }

  async getMember(id: string): Promise<Member | undefined> {
    return this.members.get(id);
  }

  async getMemberByEmail(email: string): Promise<Member | undefined> {
    return Array.from(this.members.values()).find(
      (member) => member.email === email,
    );
  }

  async createMember(insertMember: InsertMember): Promise<Member> {
    const id = randomUUID();
    const member: Member = { 
      ...insertMember, 
      id,
      fechaRegistro: new Date()
    };
    this.members.set(id, member);
    return member;
  }
}

export const storage = new MemStorage();
