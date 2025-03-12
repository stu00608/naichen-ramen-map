"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { collection, query, orderBy, getDocs } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Shop } from "@/types"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

export default function ShopsPage() {
  const [shops, setShops] = useState<Shop[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchShops = async () => {
      try {
        const q = query(collection(db, "shops"), orderBy("created_at", "desc"))
        const querySnapshot = await getDocs(q)
        
        const shopsData: Shop[] = []
        querySnapshot.forEach((doc) => {
          shopsData.push({ id: doc.id, ...doc.data() } as Shop)
        })
        
        setShops(shopsData)
      } catch (error) {
        console.error("Error fetching shops:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchShops()
  }, [])

  return (
    <div>
      <div className="flex justify-between items-center mb-6 mt-4 max-h-[30px]">
        <h1 className="text-2xl font-bold">店家管理</h1>
        <Button asChild>
          <Link href="/dashboard/shops/new">新增店家</Link>
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-10">
          <p>載入中...</p>
        </div>
      ) : shops.length === 0 ? (
        <div className="bg-card rounded-lg p-6 text-center">
          <p className="text-muted-foreground">尚未有店家資料。點擊「新增店家」開始添加。</p>
        </div>
      ) : (
        <div className="bg-card shadow-sm rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>店名</TableHead>
                <TableHead>區域</TableHead>
                <TableHead>類型</TableHead>
                <TableHead>標籤</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shops.map((shop) => (
                <TableRow key={shop.id}>
                  <TableCell>
                    <div className="font-medium">{shop.name}</div>
                    <div className="text-sm text-muted-foreground">{shop.address}</div>
                  </TableCell>
                  <TableCell>{shop.region}</TableCell>
                  <TableCell>
                    {shop.shop_types?.map((type) => (
                      <Badge key={type} variant="secondary" className="mr-1">
                        {type}
                      </Badge>
                    ))}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {shop.tags?.map((tag, index) => (
                        <Badge key={index} variant="outline">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" asChild className="mr-2">
                      <Link href={`/dashboard/shops/${shop.id}`}>編輯</Link>
                    </Button>
                    <Button variant="ghost" asChild>
                      <Link href={`/dashboard/reviews/new?shopId=${shop.id}`}>新增評價</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
} 