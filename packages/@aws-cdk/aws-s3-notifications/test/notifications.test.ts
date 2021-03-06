import { SynthUtils } from '@aws-cdk/assert';
import '@aws-cdk/assert/jest';
import s3 = require('@aws-cdk/aws-s3');
import sns = require('@aws-cdk/aws-sns');
import cdk = require('@aws-cdk/cdk');
import { Stack } from '@aws-cdk/cdk';
import s3n = require('../lib');

// tslint:disable:object-literal-key-quotes
// tslint:disable:max-line-length

test('bucket without notifications', () => {
  const stack = new cdk.Stack();

  new s3.Bucket(stack, 'MyBucket');

  expect(stack).toMatchTemplate({
    "Resources": {
      "MyBucketF68F3FF0": {
        "Type": "AWS::S3::Bucket",
        "DeletionPolicy": "Retain"
      }
    }
  });
});

test('when notification are added, a custom resource is provisioned + a lambda handler for it', () => {
  const stack = new cdk.Stack();

  const bucket = new s3.Bucket(stack, 'MyBucket');
  const topic = new sns.Topic(stack, 'MyTopic');

  bucket.addEventNotification(s3.EventType.ObjectCreated, new s3n.SnsDestination(topic));

  expect(stack).toHaveResource('AWS::S3::Bucket');
  expect(stack).toHaveResource('AWS::Lambda::Function', { Description: 'AWS CloudFormation handler for "Custom::S3BucketNotifications" resources (@aws-cdk/aws-s3)' });
  expect(stack).toHaveResource('Custom::S3BucketNotifications');
});

test('when notification are added, you can tag the lambda', () => {
  const stack = new cdk.Stack();
  stack.node.apply(new cdk.Tag('Lambda', 'AreTagged'));

  const bucket = new s3.Bucket(stack, 'MyBucket');

  const topic = new sns.Topic(stack, 'MyTopic');

  bucket.addEventNotification(s3.EventType.ObjectCreated, new s3n.SnsDestination(topic));

  expect(stack).toHaveResource('AWS::S3::Bucket');
  expect(stack).toHaveResource('AWS::Lambda::Function', {
    Tags: [{Key: 'Lambda', Value: 'AreTagged'}],
    Description: 'AWS CloudFormation handler for "Custom::S3BucketNotifications" resources (@aws-cdk/aws-s3)' });
  expect(stack).toHaveResource('Custom::S3BucketNotifications');
});

test('bucketNotificationTarget is not called during synthesis', () => {
  const stack = new cdk.Stack();

  // notice the order here - topic is defined before bucket
  // but this shouldn't impact the fact that the topic policy includes
  // the bucket information
  const topic = new sns.Topic(stack, 'Topic');
  const bucket = new s3.Bucket(stack, 'MyBucket');

  bucket.addObjectCreatedNotification(new s3n.SnsDestination(topic));

  expect(stack).toHaveResourceLike('AWS::SNS::TopicPolicy', {
    "Topics": [
    {
      "Ref": "TopicBFC7AF6E"
    }
    ],
    "PolicyDocument": {
    "Statement": [
      {
      "Action": "sns:Publish",
      "Condition": {
        "ArnLike": {
        "aws:SourceArn": {
          "Fn::GetAtt": [
          "MyBucketF68F3FF0",
          "Arn"
          ]
        }
        }
      },
      "Effect": "Allow",
      "Principal": {
        "Service": { "Fn::Join": ["", ["s3.", { Ref: "AWS::URLSuffix" }]] }
      },
      "Resource": {
        "Ref": "TopicBFC7AF6E"
      },
      }
    ],
    "Version": "2012-10-17"
    }
  });
});

test('subscription types', () => {
  const stack = new cdk.Stack();

  const bucket = new s3.Bucket(stack, 'TestBucket');

  const queueTarget: s3.IBucketNotificationDestination = {
    bind: _ => ({
      type: s3.BucketNotificationDestinationType.Queue,
      arn: 'arn:aws:sqs:...'
    })
  };

  const lambdaTarget: s3.IBucketNotificationDestination = {
    bind: _ => ({
      type: s3.BucketNotificationDestinationType.Lambda,
      arn: 'arn:aws:lambda:...'
    })
  };

  const topicTarget: s3.IBucketNotificationDestination = {
    bind: _ => ({
      type: s3.BucketNotificationDestinationType.Topic,
      arn: 'arn:aws:sns:...'
    })
  };

  bucket.addEventNotification(s3.EventType.ObjectCreated, queueTarget);
  bucket.addEventNotification(s3.EventType.ObjectCreated, lambdaTarget);
  bucket.addObjectRemovedNotification(topicTarget, { prefix: 'prefix' });

  expect(stack).toHaveResource('Custom::S3BucketNotifications', {
    "ServiceToken": {
    "Fn::GetAtt": [
      "BucketNotificationsHandler050a0587b7544547bf325f094a3db8347ECC3691",
      "Arn"
    ]
    },
    "BucketName": {
    "Ref": "TestBucket560B80BC"
    },
    "NotificationConfiguration": {
    "LambdaFunctionConfigurations": [
      {
      "Events": [
        "s3:ObjectCreated:*"
      ],
      "LambdaFunctionArn": "arn:aws:lambda:..."
      }
    ],
    "QueueConfigurations": [
      {
      "Events": [
        "s3:ObjectCreated:*"
      ],
      "QueueArn": "arn:aws:sqs:..."
      }
    ],
    "TopicConfigurations": [
      {
      "Events": [
        "s3:ObjectRemoved:*"
      ],
      "TopicArn": "arn:aws:sns:...",
      "Filter": {
        "Key": {
        "FilterRules": [
          {
          "Name": "prefix",
          "Value": "prefix"
          }
        ]
        }
      }
      }
    ]
    }
  });
});

test('multiple subscriptions of the same type', () => {
  const stack = new cdk.Stack();

  const bucket = new s3.Bucket(stack, 'TestBucket');

  bucket.addEventNotification(s3.EventType.ObjectRemovedDelete, {
    bind: _ => ({
      type: s3.BucketNotificationDestinationType.Queue,
      arn: 'arn:aws:sqs:...:queue1'
    })
  });

  bucket.addEventNotification(s3.EventType.ObjectRemovedDelete, {
    bind: _ => ({
      type: s3.BucketNotificationDestinationType.Queue,
      arn: 'arn:aws:sqs:...:queue2'
    })
  });

  expect(stack).toHaveResource('Custom::S3BucketNotifications', {
    "ServiceToken": {
    "Fn::GetAtt": [
      "BucketNotificationsHandler050a0587b7544547bf325f094a3db8347ECC3691",
      "Arn"
    ]
    },
    "BucketName": {
    "Ref": "TestBucket560B80BC"
    },
    "NotificationConfiguration": {
    "QueueConfigurations": [
      {
      "Events": [
        "s3:ObjectRemoved:Delete"
      ],
      "QueueArn": "arn:aws:sqs:...:queue1"
      },
      {
      "Events": [
        "s3:ObjectRemoved:Delete"
      ],
      "QueueArn": "arn:aws:sqs:...:queue2"
      }
    ]
    }
  });
});

test('prefix/suffix filters', () => {
  const stack = new cdk.Stack();

  const bucket = new s3.Bucket(stack, 'TestBucket');

  const bucketNotificationTarget = {
    type: s3.BucketNotificationDestinationType.Queue,
    arn: 'arn:aws:sqs:...'
  };

  bucket.addEventNotification(s3.EventType.ObjectRemovedDelete, { bind: _ => bucketNotificationTarget }, { prefix: 'images/', suffix: '.jpg' });

  expect(stack).toHaveResource('Custom::S3BucketNotifications', {
    "ServiceToken": {
    "Fn::GetAtt": [
      "BucketNotificationsHandler050a0587b7544547bf325f094a3db8347ECC3691",
      "Arn"
    ]
    },
    "BucketName": {
    "Ref": "TestBucket560B80BC"
    },
    "NotificationConfiguration": {
    "QueueConfigurations": [
      {
      "Events": [
        "s3:ObjectRemoved:Delete"
      ],
      "Filter": {
        "Key": {
        "FilterRules": [
          {
          "Name": "suffix",
          "Value": ".jpg"
          },
          {
          "Name": "prefix",
          "Value": "images/"
          }
        ]
        }
      },
      "QueueArn": "arn:aws:sqs:..."
      }
    ]
    }
  });
});

test('a notification destination can specify a set of dependencies that must be resolved before the notifications resource is created', () => {
  const stack = new Stack();

  const bucket = new s3.Bucket(stack, 'Bucket');
  const dependent = new cdk.CfnResource(stack, 'Dependent', { type: 'DependOnMe' });
  const dest: s3.IBucketNotificationDestination = {
    bind: () => ({
      arn: 'arn',
      type: s3.BucketNotificationDestinationType.Queue,
      dependencies: [ dependent ]
    })
  };

  bucket.addObjectCreatedNotification(dest);

  stack.node.prepareTree();
  expect(SynthUtils.synthesize(stack).template.Resources.BucketNotifications8F2E257D).toEqual({
    Type: 'Custom::S3BucketNotifications',
    Properties: {
      ServiceToken: { 'Fn::GetAtt': [ 'BucketNotificationsHandler050a0587b7544547bf325f094a3db8347ECC3691', 'Arn' ] },
      BucketName: { Ref: 'Bucket83908E77' },
      NotificationConfiguration: { QueueConfigurations: [ { Events: [ 's3:ObjectCreated:*' ], QueueArn: 'arn' } ] }
    },
    DependsOn: [ 'Dependent' ]
  });
});

describe('CloudWatch Events', () => {
  test('onPutItem contains the Bucket ARN itself when path is undefined', () => {
    const stack = new cdk.Stack();
    const bucket = s3.Bucket.fromBucketAttributes(stack, 'Bucket', {
      bucketName: 'MyBucket',
    });
    bucket.onCloudTrailPutObject('PutRule', {
      target: {
        bind: () => ({ arn: 'ARN', id: 'ID' })
      }
    });

    expect(stack).toHaveResourceLike('AWS::Events::Rule', {
      "EventPattern": {
        "source": [
          "aws.s3",
        ],
        "detail": {
          "eventName": [
            "PutObject",
          ],
          "resources": {
            "ARN": [
              {
                "Fn::Join": [
                  "",
                  [
                    "arn:",
                    {
                      "Ref": "AWS::Partition",
                    },
                    ":s3:::MyBucket",
                  ],
                ],
              },
            ],
          },
        },
      },
      "State": "ENABLED",
    });
  });

  test("onPutItem contains the path when it's provided", () => {
    const stack = new cdk.Stack();
    const bucket = s3.Bucket.fromBucketAttributes(stack, 'Bucket', {
      bucketName: 'MyBucket',
    });
    bucket.onCloudTrailPutObject('PutRule', {
      target: {
        bind: () => ({ arn: 'ARN', id: 'ID' })
      },
      paths: ['my/path.zip']
    });

    expect(stack).toHaveResourceLike('AWS::Events::Rule', {
      "EventPattern": {
        "source": [
          "aws.s3",
        ],
        "detail": {
          "eventName": [
            "PutObject",
          ],
          "resources": {
            "ARN": [
              {
                "Fn::Join": [
                  "",
                  [
                    "arn:",
                    {
                      "Ref": "AWS::Partition",
                    },
                    ":s3:::MyBucket/my/path.zip"
                  ],
                ],
              },
            ],
          },
        },
      },
      "State": "ENABLED",
    });
  });
});
