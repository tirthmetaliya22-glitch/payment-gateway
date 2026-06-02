from typing import Optional, Union, Annotated, Any, List, Dict
from bson import ObjectId
from pydantic import BaseModel, BeforeValidator, PlainSerializer, WithJsonSchema, ConfigDict, Field
from datetime import datetime

def validate_object_id(v: Any) -> ObjectId:
    if isinstance(v, ObjectId):
        return v
    if isinstance(v, str):
        if ObjectId.is_valid(v):
            return ObjectId(v)
        return v
    raise ValueError("Invalid ObjectId or string")

PyObjectId = Annotated[
    str,
    BeforeValidator(lambda x: str(x) if isinstance(x, ObjectId) else x),
    PlainSerializer(lambda v: str(v), return_type=str),
    WithJsonSchema({"type": "string", "example": "61a8a97c88b9071c89078ff6"})
]

class Payment(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)
    name: str
    amount: str
    currency: str = "INR"
    status: str = "Active"
    upi_id: str = "nexify@okicici" # Default VPA
    custom_qr_link: str = None # Optional custom QR link
    # payment_session_id: str = None # Added for Cashfree integration
    order_id: str = None # Optional custom order ID
    return_url: str = None # Optional custom return URL
    # email: str = None # Merchant email - used to link payment to a merchant
    user_id: Optional[PyObjectId] = None
    timestamp: bool = True

class Settlement(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)
    id: str
    amount: str
    status: str
    date: str
    bank: str
    email: str
    user_id: Optional[PyObjectId] = None
    # created_at: Optional[str] = Field(default_factory=now_iso, description="Timestamp of creation")
    timestamp: bool = True

class Customer(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)
    id: Optional[str] = None
    name: str
    email: str
    totalSpend: Optional[str] = "₹0.00"
    orders: Optional[int] = 0
    joined: Optional[str] = None
    merchant_email: str
    user_id: Optional[PyObjectId] = None
    # created_at: Optional[str] = Field(default_factory=now_iso, description="Timestamp of creation")
    # updated_at: Optional[str] = Field(default_factory=now_iso, description="Timestamp of last update")
    timestamp: bool = True

class ContactInquiry(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)
    name: str
    phone: str
    email: str
    username: str
    user_id: Optional[PyObjectId] = None
    # created_at: Optional[str] = Field(default_factory=now_iso, description="Timestamp of creation")
    # updated_at: Optional[str] = Field(default_factory=now_iso, description="Timestamp of last update")
    timestamp: bool = True

class MerchantProfile(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)
    name: str
    email: str
    business_name: Optional[str] = None
    tax_id: Optional[str] = None
    # created_at: Optional[str] = Field(default_factory=now_iso, description="Timestamp of creation")
    # updated_at: Optional[str] = Field(default_factory=now_iso, description="Timestamp of last update")
    timestamp: bool = True

class PasswordUpdate(BaseModel):
    email: str
    current_password: str
    new_password: str

class LoginRequest(BaseModel):
    email: str
    password: str
    required_role: str

class SupportTicket(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)
    subject: str
    merchant: str
    priority: str = "Medium"
    status: str = "Open"
    message: str = ""
    user_id: Optional[PyObjectId] = None
    # created_at: Optional[str] = Field(default_factory=now_iso, description="Timestamp of creation")
    # updated_at: Optional[str] = Field(default_factory=now_iso, description="Timestamp of last update")
    timestamp: bool = True

class SupportTicketReply(BaseModel):
    reply_text: str
    status: str = "Resolved"

class AdminSettings(BaseModel):
    general: dict
    security: dict
    api: dict

class MerchantInvite(BaseModel):
    name: str
    email: str
    amount: Optional[str] = None
    # created_at: Optional[str] = Field(default_factory=now_iso, description="Timestamp of creation")
    # updated_at: Optional[str] = Field(default_factory=now_iso, description="Timestamp of last update")
    timestamp: bool = True

class RegenerateKeysRequest(BaseModel): 
    email: str

class ActivateRequest(BaseModel):
    inquiry_id: str
    password: str

class CreateMerchantRequest(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)
    name: str
    email: str
    password: str
    username: str = None
    plan: str = "Standard"
    role: str = "merchant"
    wallet_balance: float = 0.0
    user_id: Optional[PyObjectId] = None
    # created_at: Optional[str] = Field(default_factory=now_iso, description="Timestamp of creation")
    # updated_at: Optional[str] = Field(default_factory=now_iso, description="Timestamp of last update")
    timestamp: bool = True

class AddFundsRequest(BaseModel):
    amount: float

class WithdrawRequest(BaseModel):
    amount: float
    bank_account: Optional[str] = None
    ifsc_code: Optional[str] = None
    remarks: Optional[str] = None
    type: Optional[str] = "bank_transfer" # "bank_transfer" or "self_withdrawal"
    user_id: Optional[PyObjectId] = None

class AdminWithdrawRequest(BaseModel):
    merchant_identifier: str
    amount: float
    bank_account: Optional[str] = None
    ifsc_code: Optional[str] = None
    remarks: Optional[str] = None
    type: Optional[str] = "bank_transfer" # "bank_transfer" or "self_withdrawal"
