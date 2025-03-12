"use client"

import * as React from "react"
import {
  Utensils,
  MessageSquareMore,
  FileQuestion,
} from "lucide-react"

import { NavMain } from "@/components/nav-main"
import { NavProjects } from "@/components/nav-projects"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"

const data = {
  user: {
    name: "Naichen Example",
    email: "nrm@gmail.com",
    avatar: "/avatars/shadcn.jpg",
  },
  navTools: [
    {
      title: "店家",
      url: "#",
      icon: Utensils,
      isActive: true,
      items: [
        {
          title: "創建店家",
          url: "/dashboard/shops/new",
        },
        {
          title: "店家管理",
          url: "/dashboard/shops/",
        },
      ]
    },
    {
      title: "評價",
      url: "#",
      icon: MessageSquareMore,
      isActive: true,
      items: [
        {
          title: "新增評價",
          url: "#",
        },
        {
          title: "評價管理",
          url: "#",
        },
      ]
    }
  ],
  articles: [
    {
      name: "如何新增一篇紀錄",
      url: "#",
      icon: FileQuestion,
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <NavUser user={data.user} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navTools} />
        <NavProjects projects={data.articles} />
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}
