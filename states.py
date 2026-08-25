from aiogram.fsm.state import State, StatesGroup
class OrderFSM(StatesGroup):
    waiting_for_name = State()
    waiting_for_phone = State()
    waiting_for_delivery_type = State()
    waiting_for_address = State()
    waiting_for_delivery_date = State()
    waiting_for_payment_method = State()

class CancelOrderFSM(StatesGroup):
    waiting_for_reason = State()