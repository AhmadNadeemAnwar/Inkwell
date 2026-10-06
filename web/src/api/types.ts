export type PostStatus = 'Draft' | 'Published' | 'Inactive'

export interface Author {
  id: string
  handle: string
  displayName: string
  avatarUrl: string | null
  bio: string | null
}

export interface Tag {
  id: string
  name: string
  slug: string
  postCount: number
}

export interface PostSummary {
  id: string
  slug: string | null
  title: string
  subtitle: string | null
  excerpt: string
  coverImageUrl: string | null
  readingTimeMinutes: number
  clapCount: number
  insightfulCount: number
  commentCount: number
  status: PostStatus
  publishedAt: string | null
  author: Author
  tags: Tag[]
}

export interface ViewerState {
  hasBookmarked: boolean
  isFollowingAuthor: boolean
  isAuthor: boolean
}

export interface PostDetail extends Omit<PostSummary, 'excerpt'> {
  contentJson: string
  viewCount: number
  updatedAt: string
  viewer: ViewerState | null
}

export type ReactionKind = 'clap' | 'insightful'

/** A post's reaction totals, and which of them this browser has given. */
export interface ReactionState {
  clapCount: number
  insightfulCount: number
  clapped: boolean
  markedInsightful: boolean
}

export interface Comment {
  id: string
  body: string
  isDeleted: boolean
  createdAt: string
  author: Author
  replies: Comment[]
}

export interface Profile {
  id: string
  handle: string
  displayName: string
  bio: string | null
  avatarUrl: string | null
  websiteUrl: string | null
  joinedAt: string
  postCount: number
  followerCount: number
  followingCount: number
  isFollowing: boolean
  isSelf: boolean
}

export interface CurrentUser {
  id: string
  email: string
  handle: string
  displayName: string
  bio: string | null
  avatarUrl: string | null
  websiteUrl: string | null
}

export interface AuthResponse {
  token: string
  expiresAt: string
  user: CurrentUser
}

export interface Paged<T> {
  items: T[]
  pageNumber: number
  pageSize: number
  totalCount: number
  totalPages: number
  hasNextPage: boolean
}

export type PostSort = 'Latest' | 'Popular' | 'Trending'
