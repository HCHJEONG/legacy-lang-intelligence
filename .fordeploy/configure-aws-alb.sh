#!/usr/bin/env bash
set -euo pipefail

: "${AWS_REGION:=ap-northeast-2}"
: "${ALB_NAME:=penvot-internet-facing-1}"
: "${MEDIUM_INSTANCE_ID:?Set MEDIUM_INSTANCE_ID to the t3a.medium instance id}"
: "${COBOL_HOST:=cobolai.penvot.com}"
: "${PHYSICAL_HOST:=physicalai.penvot.com}"
: "${COBOL_PORT:=3300}"
: "${FRONTEND_TARGET_GROUP_NAME:=penvot-alb-tg-fe-blue}"
: "${OLD_HOST:=ai.sampoongapt.com}"
: "${OLD_HOST_ZONE:=sampoongapt.com}"

ALB_ARN="$(aws elbv2 describe-load-balancers --names "$ALB_NAME" --region "$AWS_REGION" --query 'LoadBalancers[0].LoadBalancerArn' --output text)"
VPC_ID="$(aws elbv2 describe-load-balancers --load-balancer-arns "$ALB_ARN" --region "$AWS_REGION" --query 'LoadBalancers[0].VpcId' --output text)"
HTTPS_LISTENER="$(aws elbv2 describe-listeners --load-balancer-arn "$ALB_ARN" --region "$AWS_REGION" --query 'Listeners[?Port==`443`].ListenerArn | [0]' --output text)"
HTTP_LISTENER="$(aws elbv2 describe-listeners --load-balancer-arn "$ALB_ARN" --region "$AWS_REGION" --query 'Listeners[?Port==`80`].ListenerArn | [0]' --output text)"

ALB_SG_ID="$(aws elbv2 describe-load-balancers --load-balancer-arns "$ALB_ARN" --region "$AWS_REGION" --query 'LoadBalancers[0].SecurityGroups[0]' --output text)"
INSTANCE_SG_ID="$(aws ec2 describe-instances --instance-ids "$MEDIUM_INSTANCE_ID" --region "$AWS_REGION" --query 'Reservations[0].Instances[0].SecurityGroups[0].GroupId' --output text)"
if [ -z "$ALB_SG_ID" ] || [ -z "$INSTANCE_SG_ID" ]; then
  echo "Could not resolve ALB or instance security group" >&2
  exit 1
fi

HAS_ALB_3300="$(aws ec2 describe-security-groups --group-ids "$INSTANCE_SG_ID" --region "$AWS_REGION" --query "SecurityGroups[0].IpPermissions[?IpProtocol=='tcp' && FromPort==\`$COBOL_PORT\` && ToPort==\`$COBOL_PORT\`].UserIdGroupPairs[?GroupId=='$ALB_SG_ID'] | length(@)" --output text)"
if [ "$HAS_ALB_3300" != "1" ]; then
  aws ec2 authorize-security-group-ingress --group-id "$INSTANCE_SG_ID" --protocol tcp --port "$COBOL_PORT" --source-group "$ALB_SG_ID" --region "$AWS_REGION" >/dev/null
fi

TARGET_GROUP_ARN="$(aws elbv2 describe-target-groups --names cobolai-tg --region "$AWS_REGION" --query 'TargetGroups[0].TargetGroupArn' --output text 2>/dev/null || true)"
if [ -z "$TARGET_GROUP_ARN" ] || [ "$TARGET_GROUP_ARN" = "None" ]; then
  TARGET_GROUP_ARN="$(aws elbv2 create-target-group --name cobolai-tg --protocol HTTP --port "$COBOL_PORT" --vpc-id "$VPC_ID" --target-type instance --health-check-path /en --region "$AWS_REGION" --query 'TargetGroups[0].TargetGroupArn' --output text)"
fi
aws elbv2 register-targets --target-group-arn "$TARGET_GROUP_ARN" --targets Id="$MEDIUM_INSTANCE_ID",Port="$COBOL_PORT" --region "$AWS_REGION"

aws elbv2 describe-rules --listener-arn "$HTTPS_LISTENER" --region "$AWS_REGION" --query "Rules[?Conditions[?Values && contains(Values, '${COBOL_HOST}')]].RuleArn" --output text | xargs -r -n1 aws elbv2 delete-rule --rule-arn
aws elbv2 describe-rules --listener-arn "$HTTPS_LISTENER" --region "$AWS_REGION" --query "Rules[?Conditions[?Values && contains(Values, '${OLD_HOST}')]].RuleArn" --output text | xargs -r -n1 aws elbv2 delete-rule --rule-arn
USED_90="$(aws elbv2 describe-rules --listener-arn "$HTTPS_LISTENER" --region "$AWS_REGION" --query 'Rules[?Priority==`90`].RuleArn' --output text)"
USED_91="$(aws elbv2 describe-rules --listener-arn "$HTTPS_LISTENER" --region "$AWS_REGION" --query 'Rules[?Priority==`91`].RuleArn' --output text)"
if [ -n "$USED_90" ] && [ "$USED_90" != "None" ]; then echo "ALB priority 90 is already in use" >&2; exit 1; fi
if [ -n "$USED_91" ] && [ "$USED_91" != "None" ]; then echo "ALB priority 91 is already in use" >&2; exit 1; fi
aws elbv2 create-rule --listener-arn "$HTTPS_LISTENER" --priority 90 --conditions "Field=host-header,HostHeaderConfig={Values=[${COBOL_HOST}]}" --actions "Type=forward,TargetGroupArn=${TARGET_GROUP_ARN}" --region "$AWS_REGION" >/dev/null

FRONTEND_TARGET_GROUP_ARN="$(aws elbv2 describe-target-groups --names "$FRONTEND_TARGET_GROUP_NAME" --region "$AWS_REGION" --query 'TargetGroups[0].TargetGroupArn' --output text)"
if [ -n "$FRONTEND_TARGET_GROUP_ARN" ] && [ "$FRONTEND_TARGET_GROUP_ARN" != "None" ]; then
  aws elbv2 describe-rules --listener-arn "$HTTPS_LISTENER" --region "$AWS_REGION" --query "Rules[?Conditions[?Values && contains(Values, '${PHYSICAL_HOST}')]].RuleArn" --output text | xargs -r -n1 aws elbv2 delete-rule --rule-arn
  aws elbv2 create-rule --listener-arn "$HTTPS_LISTENER" --priority 91 --conditions "Field=host-header,HostHeaderConfig={Values=[${PHYSICAL_HOST}]}" --actions "Type=forward,TargetGroupArn=${FRONTEND_TARGET_GROUP_ARN}" --region "$AWS_REGION" >/dev/null
fi

echo "Registered ${COBOL_HOST} -> ${TARGET_GROUP_ARN} -> ${MEDIUM_INSTANCE_ID}:${COBOL_PORT}"
echo "Registered ${PHYSICAL_HOST} -> ${FRONTEND_TARGET_GROUP_NAME}"
