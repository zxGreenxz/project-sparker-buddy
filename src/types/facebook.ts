export interface FacebookVideo {
  objectId: string;
  title: string;
  statusLive: 0 | 1;
  countComment: number;
  countReaction: number;
  channelCreatedTime: string;
  thumbnail?: {
    url: string;
  };
}

export interface FacebookComment {
  id: string;
  message: string;
  from: {
    name: string;
    id: string;
  };
  created_time: string;
  like_count: number;
}

export interface TPOSOrder {
  Id: string;
  Code: string;
  SessionIndex?: string | number;
  Facebook_UserId: string | null;
  Facebook_PostId: string;
  Facebook_ASUserId: string;
  Facebook_CommentId: string;
  Facebook_UserName: string;
  Telephone: string;
  Name: string;
  Note: string;
  PartnerId: number;
  PartnerName: string;
  PartnerStatus: string;
  PartnerStatusText: string | null;
  TotalAmount: number;
  TotalQuantity: number;
  DateCreated: string;
  StatusText: string;
  order_count?: number;
}

export interface TPOSPartner {
  Id: number;
  Name: string;
  Phone: string;
  Status: string;
  StatusText: string;
  Address: string;
  CityName: string;
  DistrictName: string;
  WardName: string;
}

export interface CommentWithStatus extends FacebookComment {
  partnerStatus?: string;
  orderInfo?: TPOSOrder;
  isLoadingStatus?: boolean;
}