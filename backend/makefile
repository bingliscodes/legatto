dev:
	uvicorn app.main:app --reload

worker:
	celery -A app.celery_app worker --loglevel=info --pool=solo -B