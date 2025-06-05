# 奶辰的拉麵地圖應用開發指南

## 專案概述

此專案包含兩個主要部分：一個後台管理系統供記錄和管理拉麵店資料，以及一個公開的地圖網站展示這些拉麵店資訊。整個系統採用Next.js、React和Firebase服務構建。

## 技術架構

### 核心技術

- **前端框架**：Next.js 14+ (App Router)
- **UI庫**：React 18+, shadcn/ui
- **開發語言**：TypeScript
- **樣式系統**：TailwindCSS
- **表單處理**：React Hook Form + Zod
- **地圖服務**：Mapbox GL JS (Dark Style)
- **設計主題**：黑色主題，簡約現代風格

### Firebase服務

- **Firestore**：NoSQL資料庫，用於儲存所有結構化資料
- **Firebase Storage**：圖片儲存服務
- **Firebase Authentication**：使用者認證服務
- **Firebase Hosting**：網站託管服務（可選，亦可使用Vercel）
- **Firebase Functions**：後端服務（用於進階功能和未來的API整合）

## 資料模型設計

### 1. 資料庫結構（Firestore）

**shops 集合**

```
shops/{shopId}
|-- name: String          // 店名
|-- address: String       // 地址
|-- location: GeoPoint    // 地理座標
|-- business_hours: Map   // 營業時間
|-- closed_days: Array    // 公休日
|-- region: String        // 區域
|-- shop_type: String     // 拉麵類型
|-- created_at: Timestamp // 建立時間
|-- updated_at: Timestamp // 更新時間
|-- tags: Array           // 標籤列表
|-- search_keywords: Array // 搜尋關鍵字（店名分詞、地址分詞等）
|-- average_rating: Number // 平均評分
|-- ratings_count: Number  // 評分數量
|-- external_ratings: Map  // 外部評分來源數據（擴展性考量）
```

**reviews 集合**

```
reviews/{reviewId}
|-- shop_id: String         // 關聯店家ID
|-- ramen_item: String      // 拉麵品項
|-- price: Number           // 價格
|-- visit_date: Timestamp   // 造訪日期
|-- preference: Map         // 個人喜好設定
|-- side_menu: Array        // 副餐
|-- soup_score: Number      // 湯頭評分
|-- noodle_score: Number    // 麵條評分
|-- topping_score: Number   // 配料評分
|-- appearance_score: Number // 外觀評分
|-- experience_score: Number // 店家體驗評分
|-- value_score: Number     // 性價比評分
|-- overall_score: Number   // 綜合評分
|-- notes: String           // 備註
|-- created_at: Timestamp   // 建立時間
|-- updated_at: Timestamp   // 更新時間
|-- images: Array           // 圖片參考列表
|-- search_content: String  // 搜尋用全文內容
|-- source: String          // 評價來源（自建/Google/Tabelog等）
```

**tags 集合**

```
tags/{tagId}
|-- name: String          // 標籤名稱
|-- count: Number         // 使用次數
|-- created_at: Timestamp // 建立時間
```

**images 集合**

```
images/{imageId}
|-- review_id: String     // 關聯評價ID
|-- shop_id: String       // 關聯店家ID
|-- storage_path: String  // 儲存路徑
|-- thumbnail_path: String // 縮圖路徑
|-- is_primary: Boolean   // 是否為主圖
|-- width: Number         // 原始寬度
|-- height: Number        // 原始高度
|-- size: Number          // 檔案大小
|-- created_at: Timestamp // 上傳時間
```

**external_data 集合（擴展性設計）**

```
external_data/{sourceId}
|-- shop_id: String       // 關聯店家ID
|-- source: String        // 資料來源（Google/Tabelog等）
|-- source_id: String     // 外部來源ID
|-- data: Map             // 原始資料
|-- processed_data: Map   // 處理後資料
|-- last_updated: Timestamp // 最後更新時間
|-- sentiment_analysis: Map // AI分析結果（情緒、關鍵詞等）
```

### 2. 索引策略

為提高查詢效能，建立以下索引：
- `reviews` 集合按 `shop_id` + `visit_date` 排序（查詢特定店家的評價記錄）
- `reviews` 集合按 `overall_score` 降序排列（查詢最高評分評價）
- `shops` 集合按 `region` + `shop_type` 排序（區域和類型篩選）
- `shops` 集合按 `search_keywords` + `average_rating` 排序（搜尋功能優化）
- `reviews` 集合建立全文搜尋索引（或使用Firebase第三方搜尋整合）

## 功能實作策略

### 1. 認證系統

使用Firebase Authentication實現：
- 電子郵件/密碼認證
- Google帳號登入（可選）
- 權限控制（僅授權使用者可訪問後台）
- 使用shadcn/ui的authentication組件建立登入界面

### 2. 搜尋功能實作

**全文搜尋策略**：
- **索引準備**：為店家名稱、地址、評價內容等建立搜尋索引
- **分詞處理**：將店名、地址等文本分詞儲存於`search_keywords`陣列
- **多欄位搜尋**：同時檢索店家和評價集合
- **相關性排序**：根據匹配程度和評分進行排序

**搜尋功能具體實作**：
1. **前端實作**：
- 使用shadcn/ui的Command組件建立搜尋介面
- 實作自動完成功能
- 支援即時搜尋結果顯示
- 搜尋結果高亮顯示匹配內容

1. **後端查詢邏輯**：
    
    ```tsx
    // 實作多集合搜尋函數async function searchRamenShops(query: string) {
      // 分詞處理  const keywords = generateKeywords(query);  // 查詢店家集合  const shopsQuery = db.collection('shops')
        .where('search_keywords', 'array-contains-any', keywords)
        .orderBy('average_rating', 'desc')
        .limit(10);  // 查詢評價集合  const reviewsQuery = db.collection('reviews')
        .where('search_content', '>=', query)
        .where('search_content', '<=', query + '\uf8ff')
        .limit(10);  // 並行執行查詢  const [shopsSnapshot, reviewsSnapshot] = await Promise.all([
        shopsQuery.get(),    reviewsQuery.get()
      ]);  // 處理店家搜尋結果  const shopsResults = shopsSnapshot.docs.map(doc => ({
        id: doc.id,    ...doc.data(),    type: 'shop'  }));  // 處理評價搜尋結果，找出相關店家  const shopIds = new Set();  const reviewsResults = [];  for (const doc of reviewsSnapshot.docs) {
        const data = doc.data();    shopIds.add(data.shop_id);    reviewsResults.push({
          id: doc.id,      ...data,      type: 'review'    });  }
      // 獲取評價相關聯的店家  let relatedShops = [];  if (shopIds.size > 0) {
        const relatedShopsSnapshot = await db.collection('shops')
          .where(firebase.firestore.FieldPath.documentId(), 'in', Array.from(shopIds))
          .get();    relatedShops = relatedShopsSnapshot.docs.map(doc => ({
          id: doc.id,      ...doc.data(),      type: 'shop',      fromReview: true    }));  }
      // 合併結果，去重並排序  const combinedResults = mergeAndRankResults(shopsResults, relatedShops, reviewsResults, query);  return combinedResults;}
    ```
    
2. **搜尋結果展示**：
    - 在地圖上高亮顯示匹配的店家
    - 提供搜尋結果側邊欄
    - 支援根據匹配項（店名、評價、標籤等）分類顯示

### 3. 圖片優化策略

實作多層級圖片優化策略：

**上傳前優化**：
- 使用瀏覽器端壓縮，限制原始圖片大小（最大2MB）
- 自動轉換為WebP格式（如瀏覽器支援）
- 調整圖片尺寸不超過1200px寬度

**儲存策略**：
- 原圖：儲存壓縮後的原始圖片
- 縮圖（thumbnail）：生成400px寬的縮圖用於列表顯示
- 預覽圖（preview）：生成800px寬的圖片用於詳情頁

**下載與顯示策略**：
- 使用縮圖用於列表和地圖標記
- 使用漸進式載入，先顯示模糊縮圖，再載入高清圖片
- 實作懶加載（Lazy Loading），僅當圖片進入視窗時才載入

**圖片處理方案**：
- 選項1：使用Firebase Storage觸發器自動生成縮圖
- 選項2：使用瀏覽器端圖片處理並一次上傳多個尺寸

### 4. 漸進式載入策略

**資料載入**：
- 實作分頁查詢，每次載入有限數量記錄
- 使用無限滾動替代分頁導航
- 按需查詢，僅載入視圖中可見的資料

**地圖優化**：
- 僅載入當前視窗區域的店家標記
- 實作標記叢集（Marker Clustering），減少大範圍查看時的標記數量
- 使用地理位置索引提高查詢效率

**圖片載入**：
- 實作漸進式JPEG/WebP載入
- 使用骨架屏（Skeleton Screen）技術
- 優先載入可視區域內容

### 5. 後台管理系統

**店家管理**：
- 整合Google Places API自動獲取店家資訊
- 地理座標自動化獲取
- 批量編輯功能
- 使用shadcn/ui的Dashboard組件建立管理介面

**評價系統**：
- 視覺化評分界面
- 圖片批量上傳與預覽
- 自動計算加權綜合評分

**標籤系統**：
- 自動完成現有標籤
- 標籤使用頻率分析
- 自定義標籤顏色（可選）

### 6. 地圖前台

**設計思路**：
- 響應式設計，確保移動端優良體驗
- 全屏地圖為主，輔以浮動控制元素
- 黑色主題設計，Mapbox使用Dark Style

**互動功能**：
- 地圖標記按評分使用不同顏色
- 點擊標記顯示概要資訊
- 滑動卡片瀏覽附近店家
- 支援手勢操作（放大、縮小、平移）

**搜尋篩選**：
- 多條件篩選（評分、類型、區域）
- 當前位置為中心的距離排序
- 標籤篩選器
- 搜尋框置頂，支援關鍵字搜尋

## 未來擴展性設計

### 1. 外部評價爬蟲與AI分析

**架構設計**：
- 使用Firebase Functions建立排程爬蟲任務
- 建立外部資料抓取與更新管道
- 設計外部數據標準化流程

**爬蟲功能**：
- Google Maps評價爬蟲
- Tabelog評價爬蟲
- 其他本地評價網站（如需要）

**AI分析功能**：
- 使用NLP進行評價情感分析
- 關鍵詞提取與標籤自動生成
- 評價摘要生成
- 評分一致性分析

**實作策略**：
1. **獨立微服務**：
- 建立獨立的爬蟲與AI處理服務
- 使用Firebase Functions或專用雲服務
- 設計API接口供主應用調用

1. **資料整合流程**：
    
    ```
    外部資料來源 → 爬蟲服務 → 原始資料儲存 → AI處理 → 標準化資料 → Firestore
    ```
    
2. **資料模型擴展**：
    - 外部評價獨立儲存，通過關聯ID連接
    - 評價來源明確標記
    - AI標籤與人工標籤區分
3. **前端展示**：
    - 分類顯示自建評價與外部評價
    - 提供AI分析摘要
    - 綜合評分系統

### 2. 其他擴展功能規劃

**用戶貢獻系統**：
- 允許註冊用戶提交新店家與評價
- 建立審核流程
- 用戶信譽系統

**社交功能**：
- 用戶收藏列表
- 分享功能
- 用戶評價互動

**個人化推薦**：
- 基於用戶偏好的拉麵推薦
- 訪問歷史與待訪清單
- 個人化地圖視圖

## 技術實施建議

### 1. Firebase設置

**Firestore規則**：

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 所有用戶可讀取店家和評價數據
    match /shops/{shop} {
      allow read: if true;
      allow write: if request.auth != null;
    }

    match /reviews/{review} {
      allow read: if true;
      allow write: if request.auth != null;
    }

    // 只有已認證用戶可讀寫標籤
    match /tags/{tag} {
      allow read: if true;
      allow write: if request.auth != null;
    }

    // 圖片記錄僅認證用戶可寫入
    match /images/{image} {
      allow read: if true;
      allow write: if request.auth != null;
    }

    // 外部數據僅管理員可寫入
    match /external_data/{document=**} {
      allow read: if true;
      allow write: if request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
  }
}
```

**Storage規則**：

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /images/{imageId} {
      // 所有人都可以讀取圖片
      allow read: if true;
      // 只有認證用戶可以上傳圖片
      allow write: if request.auth != null
                   && request.resource.size < 5 * 1024 * 1024
                   && request.resource.contentType.matches('image/.*');
    }
  }
}
```

### 2. 前端架構

建議使用類似以下的專案結構：

```
/
├── src/
│   ├── app/
│   │   ├── admin/          # 後台管理
│   │   │   ├── shops/      # 店家管理頁面
│   │   │   ├── reviews/    # 評價管理頁面
│   │   │   └── external/   # 外部數據管理頁面
│   │   ├── api/            # API路由
│   │   │   ├── auth/       # 認證API
│   │   │   ├── search/     # 搜尋API
│   │   │   └── data/       # 數據API
│   │   └── (map)/          # 公開地圖路由
│   ├── components/
│   │   ├── admin/          # 後台元件
│   │   ├── map/            # 地圖元件
│   │   ├── search/         # 搜尋相關元件
│   │   └── ui/             # UI元件（使用shadcn/ui）
│   ├── hooks/              # 自定義hooks
│   │   ├── useAuth.ts      # 認證相關
│   │   ├── useFirestore.ts # 資料庫操作
│   │   ├── useSearch.ts    # 搜尋功能
│   │   └── useStorage.ts   # 儲存操作
│   ├── lib/
│   │   ├── firebase.ts     # Firebase初始化
│   │   ├── mapbox.ts       # Mapbox工具函數
│   │   └── search.ts       # 搜尋邏輯
│   ├── styles/
│   │   └── theme.ts        # 黑色主題配置
│   └── types/              # TypeScript型別定義
└── middleware.ts           # 路由中間件(身份驗證)
```

### 3. UI設計指南

**設計原則**：
- 簡約現代風格
- 黑色主題為主
- 高對比度UI元素

**組件使用**：
- 使用shadcn/ui的預製組件
- 認證頁面：使用shadcn/ui的Authentication組件
- 儀表板：使用shadcn/ui的Dashboard組件
- 表單：使用shadcn/ui的Form組件和React Hook Form

**地圖樣式**：
- Mapbox使用Dark Style
- 自定義標記樣式匹配應用主題
- 控制元素使用透明背景增強沉浸感

**響應式設計**：
- 移動優先設計
- 卡片式設計易於適應不同屏幕
- 側邊功能區自動收起與展開

### 4. 效能監控

建議實作以下監控指標：
- 頁面載入時間
- 互動到響應時間
- 圖片載入效能
- Firebase操作延遲
- 搜尋查詢效能

## 部署與擴展考量

### 1. 部署選項

- **Vercel + Firebase**：前端使用Vercel部署，後端使用Firebase服務
- **純Firebase**：使用Firebase Hosting部署整個應用

### 2. 成本控制

**Firebase免費方案限制**：
- Firestore：1GB 儲存 + 10GB/月 流量
- Storage：5GB 儲存 + 1GB/日 下載流量
- Authentication：無限制用戶數
- Functions：計算時間限制（用於爬蟲與AI分析）

**控制策略**：
- 實作適當的內容分頁
- 嚴格控制圖片大小
- 使用Firebase規則限制惡意操作
- 爬蟲服務使用定時觸發而非實時執行

### 3. 擴展路徑

當應用超出免費方案限制時，考慮：
- 升級到Firebase Blaze方案（按使用量付費）
- 實作更嚴格的快取策略
- 考慮引入CDN提升圖片載入效率
- 將爬蟲與AI分析服務轉移至專用服務器（成本效益更高）

## 開發時程建議

1. **第一階段：基礎架構（2週）**
    - Firebase專案設定
    - 資料模型確認
    - 認證系統實作
    - UI主題設定
2. **第二階段：核心功能（3週）**
    - 店家管理CRUD
    - 評價系統
    - 圖片上傳與優化
    - 搜尋功能
3. **第三階段：地圖前台（3週）**
    - 地圖整合（Dark Style）
    - 標記與互動
    - 搜尋篩選功能
    - shadcn/ui組件整合
4. **第四階段：優化與測試（2週）**
    - 效能優化
    - 響應式調整
    - 使用者測試
5. **第五階段（未來）：擴展功能（4週）**
    - 外部評價爬蟲系統
    - AI分析整合
    - 高級搜尋與推薦功能

## 結語

此更新版開發指南擴展了拉麵地圖應用的功能範圍，特別增強了搜尋功能和外部數據整合的未來擴展性。通過使用shadcn/ui組件和黑色主題設計，應用將具有簡約現代的視覺風格。資料模型的擴展設計確保了系統可以無縫整合外部評價來源和AI分析功能，為未來的功能擴展提供了堅實基礎。這種架構設計既可在Firebase免費方案下運行，也能根據需求平滑擴展至付費方案。