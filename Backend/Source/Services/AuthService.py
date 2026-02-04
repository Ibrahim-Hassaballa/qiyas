from sqlalchemy.orm import Session
from Backend.Source.Models.User import User
from Backend.Source.Core.Security import get_password_hash, verify_password, create_access_token, ACCESS_TOKEN_EXPIRE_MINUTES
from datetime import timedelta
from Backend.Source.Core.Logging import logger

class AuthService:
    def get_user_by_username(self, db: Session, username: str):
        return db.query(User).filter(User.username == username).first()

    def create_user(self, db: Session, username: str, password: str):
        hashed_password = get_password_hash(password)
        db_user = User(username=username, hashed_password=hashed_password)
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
        return db_user

    def authenticate_user(self, db: Session, username: str, password: str):
        user = self.get_user_by_username(db, username)
        if not user:
            return False
        if not verify_password(password, user.hashed_password):
            return False
        return user

    def create_token_for_user(self, user: User):
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": user.username}, expires_delta=access_token_expires
        )
        return {"access_token": access_token, "token_type": "bearer"}

    def create_default_user_if_not_exists(self, db: Session):
        """Creates the default Qiyas user if no users exist or specifically checks for Qiyas"""
        user = self.get_user_by_username(db, "Qiyas")
        if not user:
            logger.info("Creating default user 'Qiyas'...")
            self.create_user(db, "Qiyas", "1208")
        else:
            logger.info("Default user 'Qiyas' already exists.")

auth_service = AuthService()
