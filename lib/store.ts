"use client"

import type { Actor, CastingProject, Folder } from "./types"
// Mock data removed - all data comes from Supabase

const STORAGE_KEYS = {
  ACTORS: "casting_db_actors",
  PROJECTS: "casting_db_projects",
  FOLDERS: "casting_db_folders",
}

export class LocalStore {
  static getActors(): Actor[] {
    if (typeof window === "undefined") return []

    const stored = localStorage.getItem(STORAGE_KEYS.ACTORS)
    if (!stored) {
      return []
    }
    return JSON.parse(stored)
  }

  static setActors(actors: Actor[]): void {
    if (typeof window === "undefined") return
    localStorage.setItem(STORAGE_KEYS.ACTORS, JSON.stringify(actors))
  }

  static getActor(id: string): Actor | undefined {
    return this.getActors().find((a) => a.id === id)
  }

  static updateActor(id: string, updates: Partial<Actor>): void {
    const actors = this.getActors()
    const index = actors.findIndex((a) => a.id === id)
    if (index !== -1) {
      actors[index] = {
        ...actors[index],
        ...updates,
        updated_at: new Date().toISOString(),
      }
      this.setActors(actors)
    }
  }

  static addActor(actor: Omit<Actor, "id" | "created_at" | "updated_at">): Actor {
    const actors = this.getActors()
    const newActor: Actor = {
      ...actor,
      id: Date.now().toString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    actors.push(newActor)
    this.setActors(actors)
    return newActor
  }

  static deleteActor(id: string): void {
    const actors = this.getActors().filter((a) => a.id !== id)
    this.setActors(actors)
  }

  static getProjects(): CastingProject[] {
    if (typeof window === "undefined") return []

    const stored = localStorage.getItem(STORAGE_KEYS.PROJECTS)
    if (!stored) {
      return []
    }
    return JSON.parse(stored)
  }

  static setProjects(projects: CastingProject[]): void {
    if (typeof window === "undefined") return
    localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(projects))
  }

  static deleteProject(id: string): void {
    const projects = this.getProjects().filter((p) => p.id !== id)
    this.setProjects(projects)
  }

  static getFolders(): Folder[] {
    if (typeof window === "undefined") return []

    const stored = localStorage.getItem(STORAGE_KEYS.FOLDERS)
    if (!stored) {
      return []
    }
    return JSON.parse(stored)
  }

  static setFolders(folders: Folder[]): void {
    if (typeof window === "undefined") return
    localStorage.setItem(STORAGE_KEYS.FOLDERS, JSON.stringify(folders))
  }

  static deleteFolder(id: string): void {
    const folders = this.getFolders().filter((f) => f.id !== id)
    this.setFolders(folders)
  }
}
