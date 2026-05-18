"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import { userCreateSchema, userUpdateSchema } from "@/lib/validations"
import { revalidatePath } from "next/cache"
import bcrypt from "bcryptjs"
import type { Role, User } from "@prisma/client"

function generateTempPassword(): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  let password = ""
  for (let i = 0; i < 10; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return password
}

export type UserWithCounts = Pick<
  User,
  "id" | "email" | "name" | "role" | "isActive" | "createdAt" | "updatedAt"
> & {
  _count: { travelRequests: number; approvals: number }
}

export async function getUsers() {
  const session = await auth()
  if (!session?.user || (session.user.role as Role) !== "ADMIN") {
    throw new Error("Action non autorisee")
  }

  return prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          travelRequests: true,
          approvals: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  })
}

export async function createUser(formData: FormData) {
  const session = await auth()
  if (!session?.user || (session.user.role as Role) !== "ADMIN") {
    return { error: "Action non autorisee" }
  }

  const rawData = {
    name: formData.get("name"),
    email: formData.get("email"),
    role: formData.get("role"),
  }

  const parsed = userCreateSchema.safeParse(rawData)
  if (!parsed.success) {
    return {
      error: "Validation echouee",
      fieldErrors: parsed.error.flatten().fieldErrors,
    }
  }

  const existing = await prisma.user.findUnique({
    where: { email: parsed.data.email },
  })
  if (existing) {
    return {
      error: "Un utilisateur avec cet email existe deja",
      fieldErrors: { email: ["Email deja utilise"] },
    }
  }

  const tempPassword = generateTempPassword()
  const hashedPassword = await bcrypt.hash(tempPassword, 12)

  await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      password: hashedPassword,
      role: parsed.data.role as Role,
      isActive: true,
    },
  })

  revalidatePath("/admin/users")
  return { success: true, tempPassword }
}

export async function updateUser(userId: string, formData: FormData) {
  const session = await auth()
  if (!session?.user || (session.user.role as Role) !== "ADMIN") {
    return { error: "Action non autorisee" }
  }

  const rawData = {
    name: formData.get("name"),
    email: formData.get("email"),
    role: formData.get("role"),
  }

  const parsed = userUpdateSchema.safeParse(rawData)
  if (!parsed.success) {
    return {
      error: "Validation echouee",
      fieldErrors: parsed.error.flatten().fieldErrors,
    }
  }

  const existing = await prisma.user.findUnique({
    where: { email: parsed.data.email },
  })
  if (existing && existing.id !== userId) {
    return {
      error: "Un utilisateur avec cet email existe deja",
      fieldErrors: { email: ["Email deja utilise"] },
    }
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      role: parsed.data.role as Role,
    },
  })

  revalidatePath("/admin/users")
  return { success: true }
}

export async function toggleUserActive(userId: string) {
  const session = await auth()
  if (!session?.user || (session.user.role as Role) !== "ADMIN") {
    throw new Error("Action non autorisee")
  }

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) {
    throw new Error("Utilisateur introuvable")
  }

  if (user.id === session.user.id) {
    throw new Error("Vous ne pouvez pas desactiver votre propre compte")
  }

  await prisma.user.update({
    where: { id: userId },
    data: { isActive: !user.isActive },
  })

  revalidatePath("/admin/users")
}

export async function resetUserPassword(userId: string) {
  const session = await auth()
  if (!session?.user || (session.user.role as Role) !== "ADMIN") {
    return { error: "Action non autorisee" }
  }

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) {
    return { error: "Utilisateur introuvable" }
  }

  const tempPassword = generateTempPassword()
  const hashedPassword = await bcrypt.hash(tempPassword, 12)

  await prisma.user.update({
    where: { id: userId },
    data: { password: hashedPassword },
  })

  revalidatePath("/admin/users")
  return { success: true, tempPassword, userName: user.name }
}

export async function deleteUser(userId: string) {
  const session = await auth()
  if (!session?.user || (session.user.role as Role) !== "ADMIN") {
    throw new Error("Action non autorisee")
  }

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) {
    throw new Error("Utilisateur introuvable")
  }

  if (user.id === session.user.id) {
    throw new Error("Vous ne pouvez pas supprimer votre propre compte")
  }

  const requestCount = await prisma.travelRequest.count({
    where: { requesterId: userId },
  })

  if (requestCount > 0) {
    throw new Error(
      "Impossible de supprimer un utilisateur avec des demandes de deplacement. Desactivez-le plutot."
    )
  }

  await prisma.user.delete({ where: { id: userId } })

  revalidatePath("/admin/users")
}
